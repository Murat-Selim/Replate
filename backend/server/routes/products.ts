import { Router, Request, Response } from "express";
import { assertDatabaseConfigured, getDatabasePool } from "../db.js";

const router = Router();
const GTIN = /^\d{8,14}$/;
const number = (value: unknown) => Number.isFinite(Number(value)) ? Number(value) : null;

function score(product: any) {
  let health = 70;
  const sugar = number(product.nutriments?.sugars_100g);
  const salt = number(product.nutriments?.salt_100g);
  const fiber = number(product.nutriments?.fiber_100g);
  if (sugar !== null) health -= Math.min(25, sugar * 1.5);
  if (salt !== null) health -= Math.min(20, salt * 8);
  if (fiber !== null && fiber >= 3) health += 10;
  return Math.max(0, Math.min(100, Math.round(health)));
}

function analysis(product: any) {
  const sugar = number(product.sugar), salt = number(product.salt), fiber = number(product.fiber);
  return {
    health: score({ nutriments: { sugars_100g: sugar, salt_100g: salt, fiber_100g: fiber } }),
    sugarLevel: sugar === null ? "unknown" : sugar > 10 ? "high" : sugar > 5 ? "moderate" : "low",
    saltLevel: salt === null ? "unknown" : salt > 1.5 ? "high" : salt > 0.3 ? "moderate" : "low",
    fiberLevel: fiber === null ? "unknown" : fiber >= 3 ? "good" : "low",
    confidence: [sugar, salt, fiber].filter((value) => value !== null).length / 3,
  };
}

function classify(product: any): "healthy" | "unhealthy" | "neutral" {
  const grade = String(product.nutrition_grade || "").toLowerCase();
  return grade === "a" || grade === "b" ? "healthy" : grade === "e" ? "unhealthy" : "neutral";
}

router.get("/barcode/:gtin", async (req: Request, res: Response) => {
  const gtin = String(req.params.gtin).trim();
  if (!GTIN.test(gtin)) return res.status(400).json({ success: false, error: "Invalid GTIN" });
  const wallet = typeof req.query.wallet === "string" ? req.query.wallet : null;

  try {
    let product: any;
    let source = "cache";
    if (process.env.DATABASE_URL) {
      const cached = await getDatabasePool().query("SELECT * FROM canonical_products WHERE gtin = $1", [gtin]);
      product = cached.rows[0];
    }
    if (!product) {
      const response = await fetch(`https://world.openfoodfacts.org/api/v2/product/${gtin}.json`, {
        headers: { "User-Agent": "Replate/1.0 (product intelligence)" },
      });
      if (!response.ok) return res.status(502).json({ success: false, error: "Product source unavailable" });
      const data = await response.json() as any;
      if (data.status !== 1 || !data.product) return res.status(404).json({ success: false, error: "Product not found", gtin });
      const p = data.product;
      source = "openfoodfacts";
      product = {
        gtin, display_name: p.product_name || "Unknown product", brand: p.brands || null,
        category: classify({ nutrition_grade: p.nutrition_grades }), quantity: p.quantity || null, ingredients: p.ingredients_text || null,
        allergens: p.allergens || null, additives: p.additives_tags?.join(", ") || null,
        nutrition_grade: p.nutrition_grades || null, nova_group: p.nova_group || null,
        energy_kcal: number(p.nutriments?.["energy-kcal_100g"]), protein: number(p.nutriments?.proteins_100g),
        carbohydrates: number(p.nutriments?.carbohydrates_100g), sugar: number(p.nutriments?.sugars_100g),
        fat: number(p.nutriments?.fat_100g), saturated_fat: number(p.nutriments?.["saturated-fat_100g"]),
        fiber: number(p.nutriments?.fiber_100g), salt: number(p.nutriments?.salt_100g),
        image_url: p.image_front_url || null, source: "openfoodfacts", source_confidence: 0.85,
        data_completeness: [p.product_name, p.nutriments?.sugars_100g, p.nutriments?.salt_100g].filter(Boolean).length / 3,
      };
      if (process.env.DATABASE_URL) {
        assertDatabaseConfigured();
        const saved = await getDatabasePool().query(
          `INSERT INTO canonical_products (gtin, canonical_key, display_name, category, default_fruit_veg_grams, brand, quantity, ingredients, allergens, additives, nutrition_grade, nova_group, energy_kcal, protein, carbohydrates, sugar, fat, saturated_fat, fiber, salt, source, source_confidence, data_completeness, image_url, last_synced_at)
           VALUES ($1,$1,$2,$3,0,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,NOW()) ON CONFLICT (gtin) DO UPDATE SET last_synced_at = NOW() RETURNING *`,
          [gtin, product.display_name, product.category, product.brand, product.quantity, product.ingredients, product.allergens, product.additives, product.nutrition_grade, product.nova_group, product.energy_kcal, product.protein, product.carbohydrates, product.sugar, product.fat, product.saturated_fat, product.fiber, product.salt, product.source, product.source_confidence, product.data_completeness, product.image_url],
        );
        product = saved.rows[0];
      }
    }
    if (process.env.DATABASE_URL && wallet) await getDatabasePool().query("INSERT INTO user_product_scans (user_wallet, product_id, gtin, source) VALUES ($1,$2,$3,$4)", [wallet, product.id || null, gtin, source]);
    const result = analysis(product);
    if (process.env.DATABASE_URL && product.id) await getDatabasePool().query(
      `INSERT INTO product_analysis (product_id, health_score, sugar_level, salt_level, fiber_level, processing_level, analysis_confidence, rule_version)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'product-rules-v1') ON CONFLICT (product_id) DO UPDATE SET health_score=$2, sugar_level=$3, salt_level=$4, fiber_level=$5, analysis_confidence=$7, created_at=NOW()`,
      [product.id, result.health, result.sugarLevel, result.saltLevel, result.fiberLevel, product.nova_group ? `nova-${product.nova_group}` : "unknown", result.confidence],
    );
    return res.json({ success: true, product, intelligence: { healthScore: result.health, category: product.category, sugarLevel: result.sugarLevel, saltLevel: result.saltLevel, fiberLevel: result.fiberLevel, confidence: result.confidence, informationalOnly: true } });
  } catch (error) {
    console.error("Barcode lookup failed", error);
    return res.status(500).json({ success: false, error: "Barcode lookup failed" });
  }
});

router.get("/history", async (req: Request, res: Response) => {
  const wallet = String(req.query.wallet || "");
  if (!/^0x[a-fA-F0-9]{40}$/.test(wallet)) return res.status(400).json({ success: false, error: "Valid wallet is required" });
  if (!process.env.DATABASE_URL) return res.json({ success: true, scans: [] });
  const scans = await getDatabasePool().query(
    `SELECT s.gtin, s.scan_timestamp, p.display_name, p.brand, p.category
     FROM user_product_scans s LEFT JOIN canonical_products p ON p.id = s.product_id
     WHERE lower(s.user_wallet) = lower($1) ORDER BY s.scan_timestamp DESC LIMIT 20`, [wallet],
  );
  return res.json({ success: true, scans: scans.rows });
});

export default router;


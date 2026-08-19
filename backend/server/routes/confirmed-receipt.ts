import { Router, Request, Response } from "express";
import { assertDatabaseConfigured, getDatabasePool } from "../db.js";
import { VerifiedReceiptError, verifyReceiptTransaction } from "../services/verified-receipt.js";
import { normalizeProduct } from "../services/product-normalization.js";
import { buildDerivedFeatures } from "../services/derived-features.js";

const router = Router();
const HASH = /^0x[a-fA-F0-9]{64}$/;
const ADDRESS = /^0x[a-fA-F0-9]{40}$/;
const CATEGORIES = new Set(["healthy", "unhealthy", "neutral", "excluded"]);

interface ProductInput {
  name: string;
  category: "healthy" | "unhealthy" | "neutral" | "excluded";
  fruitVegGrams: number;
  confidence: number;
  nutriscore?: string;
}

interface ConfirmedReceiptRequest {
  txHash: string;
  userAddress: string;
  receiptHash: string;
  receiptDate: string;
  totalItems: number;
  healthyItems: number;
  unhealthyItems: number;
  fruitVegGrams: number;
  householdSize: number;
  daysCovered: number;
  products: ProductInput[];
  ocrConfidence: number;
}

router.get("/latest", async (req: Request, res: Response) => {
  const userAddress = String(req.query.userAddress || "");
  if (!ADDRESS.test(userAddress)) {
    res.status(400).json({ success: false, error: "Valid user address is required", errorCode: "INVALID_USER_ADDRESS" });
    return;
  }

  try {
    assertDatabaseConfigured();
    const result = await getDatabasePool().query(
      `SELECT r.id, r.receipt_hash, r.tx_hash, r.health_score, r.nutrition_score,
              r.total_items, r.healthy_items, r.unhealthy_items, r.fruit_veg_grams,
              r.days_covered, r.points_earned
       FROM receipts r JOIN users u ON u.id = r.user_id
       WHERE lower(u.wallet_address) = lower($1)
       ORDER BY r.verified_at DESC LIMIT 1`,
      [userAddress],
    );
    const row = result.rows[0];
    if (!row) {
      res.status(404).json({ success: false, error: "Verified receipt not found", errorCode: "RECEIPT_NOT_FOUND" });
      return;
    }
    res.json({
      success: true,
      data: {
        receiptId: String(row.id),
        txHash: row.tx_hash,
        receiptHash: row.receipt_hash,
        healthScore: Number(row.health_score),
        nutritionScore: Number(row.nutrition_score),
        totalItems: Number(row.total_items),
        healthyItems: Number(row.healthy_items),
        unhealthyItems: Number(row.unhealthy_items),
        fruitVegGrams: Number(row.fruit_veg_grams),
        daysCovered: Number(row.days_covered),
        pointsEarned: Number(row.points_earned),
        badgeMinted: false,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : "Internal server error" });
  }
});

function fail(message: string, code: string): never {
  throw new VerifiedReceiptError(message, 400, code);
}

function validateRequest(body: ConfirmedReceiptRequest): void {
  if (!body || typeof body !== "object") fail("Request body is required", "INVALID_REQUEST");
  if (!HASH.test(body.txHash) || !HASH.test(body.receiptHash)) fail("Valid transaction and receipt hashes are required", "INVALID_HASH");
  if (!ADDRESS.test(body.userAddress)) fail("Valid user address is required", "INVALID_USER_ADDRESS");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(body.receiptDate) || Number.isNaN(Date.parse(`${body.receiptDate}T00:00:00Z`))) {
    fail("Receipt date must be YYYY-MM-DD", "INVALID_RECEIPT_DATE");
  }
  for (const [field, min, max] of [
    ["totalItems", 1, 255], ["healthyItems", 0, 255], ["unhealthyItems", 0, 255],
    ["fruitVegGrams", 0, 65535], ["householdSize", 1, 10], ["daysCovered", 1, 30],
  ] as const) {
    const value = body[field];
    if (!Number.isInteger(value) || value < min || value > max) fail(`${field} is out of range`, "INVALID_RECEIPT_VALUE");
  }
  if (!Number.isFinite(body.ocrConfidence) || body.ocrConfidence < 0 || body.ocrConfidence > 1) {
    fail("OCR confidence is out of range", "INVALID_OCR_CONFIDENCE");
  }
  if (!Array.isArray(body.products) || body.products.length > 200) fail("Products are invalid", "INVALID_PRODUCTS");
  for (const product of body.products) {
    if (!product || typeof product.name !== "string" || product.name.trim().length === 0 || product.name.length > 500) {
      fail("Product name is invalid", "INVALID_PRODUCT");
    }
    if (!CATEGORIES.has(product.category) || !Number.isInteger(product.fruitVegGrams) || product.fruitVegGrams < 0 ||
      !Number.isFinite(product.confidence) || product.confidence < 0 || product.confidence > 1) {
      fail("Product classification is invalid", "INVALID_PRODUCT");
    }
  }
}

function assertPayloadMatchesChain(body: ConfirmedReceiptRequest, onchain: Awaited<ReturnType<typeof verifyReceiptTransaction>>): void {
  const scoreable = body.products.filter((product) => product.category !== "excluded");
  const healthy = body.products.filter((product) => product.category === "healthy").length;
  const unhealthy = body.products.filter((product) => product.category === "unhealthy").length;
  const fruitVegGrams = scoreable.reduce((sum, product) => sum + product.fruitVegGrams, 0);
  if (body.totalItems !== onchain.totalItems || body.healthyItems !== onchain.healthyItems || body.unhealthyItems !== onchain.unhealthyItems ||
    body.fruitVegGrams !== onchain.fruitVegGrams || body.householdSize !== onchain.householdSize || body.daysCovered !== onchain.daysCovered ||
    scoreable.length !== onchain.totalItems || healthy !== onchain.healthyItems || unhealthy !== onchain.unhealthyItems || fruitVegGrams !== onchain.fruitVegGrams) {
    throw new VerifiedReceiptError("Analyzed receipt data does not match on-chain aggregates", 422, "PAYLOAD_AGGREGATE_MISMATCH");
  }
  if (body.userAddress.toLowerCase() !== onchain.userAddress.toLowerCase() || body.receiptHash.toLowerCase() !== onchain.receiptHash.toLowerCase()) {
    throw new VerifiedReceiptError("Receipt identity does not match the on-chain transaction", 422, "PAYLOAD_IDENTITY_MISMATCH");
  }
}

router.post("/confirmed", async (req: Request, res: Response) => {
  let client;
  try {
    const body = req.body as ConfirmedReceiptRequest;
    validateRequest(body);
    const onchain = await verifyReceiptTransaction(body.txHash);
    assertPayloadMatchesChain(body, onchain);
    assertDatabaseConfigured();
    client = await getDatabasePool().connect();
    await client.query("BEGIN");

    await client.query("INSERT INTO users (wallet_address) VALUES ($1) ON CONFLICT DO NOTHING", [onchain.userAddress]);
    const user = await client.query<{ id: string; wallet_address: string }>(
      "SELECT id, wallet_address FROM users WHERE lower(wallet_address) = lower($1) FOR UPDATE",
      [onchain.userAddress],
    );
    const existing = await client.query<{ id: string; wallet_address: string; receipt_hash: string; tx_hash: string; builder_code_attributed: boolean | null }>(
      `SELECT r.id, u.wallet_address, r.receipt_hash, r.tx_hash, r.builder_code_attributed
       FROM receipts r JOIN users u ON u.id = r.user_id
       WHERE r.tx_hash = $1 OR r.receipt_hash = $2 LIMIT 1 FOR UPDATE`,
      [body.txHash, body.receiptHash],
    );
    if (existing.rows[0]) {
      const row = existing.rows[0];
      if (row.wallet_address.toLowerCase() !== onchain.userAddress.toLowerCase() ||
        row.receipt_hash.toLowerCase() !== onchain.receiptHash.toLowerCase() || row.tx_hash.toLowerCase() !== body.txHash.toLowerCase()) {
        throw new VerifiedReceiptError("Receipt identity conflicts with an existing record", 409, "RECEIPT_IDEMPOTENCY_CONFLICT");
      }
      await client.query("COMMIT");
      res.json({ success: true, idempotent: true, receiptId: row.id, txHash: body.txHash, receiptHash: body.receiptHash, builderCodeAttributed: row.builder_code_attributed });
      return;
    }

    const userId = user.rows[0]?.id;
    if (!userId) throw new Error("User record could not be created");
    const receipt = await client.query<{ id: string }>(
      `INSERT INTO receipts
       (user_id, receipt_hash, tx_hash, block_number, receipt_date, health_score, nutrition_score,
        total_items, detected_items, excluded_items, healthy_items, unhealthy_items, fruit_veg_grams,
       household_size, days_covered, points_earned, ocr_confidence, receipt_verification_confidence, builder_code_attributed)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,1,$18)
       RETURNING id`,
      [userId, onchain.receiptHash, body.txHash, onchain.blockNumber, body.receiptDate, onchain.healthScore,
        onchain.nutritionScore, onchain.totalItems, body.products.length, body.products.length - onchain.totalItems,
        onchain.healthyItems, onchain.unhealthyItems, onchain.fruitVegGrams, onchain.householdSize, onchain.daysCovered,
        onchain.pointsEarned, body.ocrConfidence, onchain.builderCodeAttributed],
    );
    const receiptId = receipt.rows[0].id;
    const model = await client.query<{ id: string }>(
      `INSERT INTO model_versions (model_type, version, metadata) VALUES ('classifier', 'catalog-v1', '{"source":"backend-classifier"}')
       ON CONFLICT (model_type, version) DO UPDATE SET metadata = EXCLUDED.metadata RETURNING id`,
    );
    const canonicalKeys: Array<string | null> = [];
    for (const product of body.products) {
      const normalized = normalizeProduct(product.name, product.category);
      canonicalKeys.push(normalized.canonicalKey);
      let canonicalProductId: string | null = null;
      if (normalized.canonicalKey) {
        const catalog = await client.query<{ id: string }>(
          `INSERT INTO canonical_products (canonical_key, display_name, category, default_fruit_veg_grams)
           VALUES ($1,$1,$2,$3)
           ON CONFLICT (canonical_key) DO UPDATE SET category = EXCLUDED.category,
             default_fruit_veg_grams = EXCLUDED.default_fruit_veg_grams
           RETURNING id`,
          [normalized.canonicalKey, product.category, product.fruitVegGrams],
        );
        canonicalProductId = catalog.rows[0].id;
      }
      const item = await client.query<{ id: string }>(
        `INSERT INTO receipt_items
         (receipt_id, item_name, canonical_product_id, quantity, weight_grams, fruit_veg_grams, normalization_version, normalization_confidence)
         VALUES ($1,$2,$3,1,0,$4,'catalog-v1',$5) RETURNING id`,
        [receiptId, product.name.trim(), canonicalProductId, product.fruitVegGrams, normalized.confidence],
      );
      await client.query(
        `INSERT INTO classifications (receipt_item_id, model_version_id, category, confidence, nutriscore)
         VALUES ($1,$2,$3,$4,$5)`,
        [item.rows[0].id, model.rows[0].id, product.category, product.confidence, product.nutriscore || null],
      );
    }
    for (const feature of buildDerivedFeatures(onchain, body.products, canonicalKeys)) {
      await client.query(
        `INSERT INTO derived_features (receipt_id, feature_name, feature_value, calculation_version, confidence, metadata)
         VALUES ($1,$2,$3,'features-v1',$4,$5)
         ON CONFLICT (receipt_id, feature_name, calculation_version) DO UPDATE SET feature_value = EXCLUDED.feature_value,
           confidence = EXCLUDED.confidence, metadata = EXCLUDED.metadata`,
        [receiptId, feature.name, feature.value, feature.confidence, feature.metadata],
      );
    }
    await client.query("COMMIT");
    res.status(201).json({ success: true, idempotent: false, receiptId, txHash: body.txHash, receiptHash: body.receiptHash, builderCodeAttributed: onchain.builderCodeAttributed });
  } catch (error) {
    if (client) await client.query("ROLLBACK").catch(() => undefined);
    const status = error instanceof VerifiedReceiptError ? error.status : 500;
    res.status(status).json({ success: false, error: error instanceof Error ? error.message : "Internal server error", errorCode: error instanceof VerifiedReceiptError ? error.code : "RECEIPT_PERSISTENCE_ERROR" });
  } finally {
    client?.release();
  }
});

export default router;

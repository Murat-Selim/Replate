import { Router, Request, Response } from "express";
import { assertDatabaseConfigured, getDatabasePool } from "../db.js";
import { VerifiedReceiptError, verifyReceiptTransaction } from "../services/verified-receipt.js";
import { normalizeProduct } from "../services/product-normalization.js";
import { buildDerivedFeatures } from "../services/derived-features.js";
import { getSpendingCategory } from "../services/spending-categories.js";

const router = Router();
const HASH = /^0x[a-fA-F0-9]{64}$/;
const ADDRESS = /^0x[a-fA-F0-9]{40}$/;
const CATEGORIES = new Set(["healthy", "unhealthy", "neutral", "excluded"]);

interface StagedProduct {
  name: string;
  category: "healthy" | "unhealthy" | "neutral" | "excluded";
  fruitVegGrams: number;
  confidence: number;
  paidPrice?: number;
  nutriscore?: string;
  quantity: number;
  actualWeightGrams: number;
  spendingCategory?: string;
}

interface ConfirmedReceiptRequest {
  txHash: string;
  userAddress: string;
  receiptHash: string;
}

interface StagedReceiptAnalysis {
  receiptDate: string;
  totalItems: number;
  healthyItems: number;
  unhealthyItems: number;
  fruitVegGrams: number;
  householdSize: number;
  daysCovered: number;
  ocrConfidence: number;
  products: StagedProduct[];
  storeName: string | null;
  currencyCode: string | null;
  totalSpent: number | null;
  totalSpentSource: "receipt_total" | "line_items" | null;
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
}

function assertPayloadMatchesChain(body: ConfirmedReceiptRequest, staged: StagedReceiptAnalysis, onchain: Awaited<ReturnType<typeof verifyReceiptTransaction>>): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(staged.receiptDate) || Number.isNaN(Date.parse(`${staged.receiptDate}T00:00:00Z`)) ||
    !Array.isArray(staged.products) || staged.products.length > 200 || !Number.isFinite(staged.ocrConfidence) || staged.ocrConfidence < 0 || staged.ocrConfidence > 1) {
    fail("Stored receipt analysis is invalid", "INVALID_STAGED_ANALYSIS");
  }
  const scoreable = staged.products.filter((product) => product.category !== "excluded");
  const healthy = staged.products.filter((product) => product.category === "healthy").length;
  const unhealthy = staged.products.filter((product) => product.category === "unhealthy").length;
  const fruitVegGrams = scoreable.reduce((sum, product) => sum + product.fruitVegGrams, 0);
  for (const product of staged.products) {
    if (!product || typeof product.name !== "string" || product.name.trim().length === 0 || product.name.length > 500 ||
      !CATEGORIES.has(product.category) || !Number.isInteger(product.fruitVegGrams) || product.fruitVegGrams < 0 ||
      !Number.isFinite(product.confidence) || product.confidence < 0 || product.confidence > 1 ||
      !Number.isInteger(product.quantity) || product.quantity < 1 || product.quantity > 100000 || !Number.isInteger(product.actualWeightGrams) || product.actualWeightGrams < 0 || product.actualWeightGrams > 2147483647 ||
      (product.paidPrice !== undefined && (!Number.isFinite(product.paidPrice) || product.paidPrice < 0 || product.paidPrice > 100000000))) {
      fail("Stored product analysis is invalid", "INVALID_STAGED_PRODUCT");
    }
    const unitPrice = product.paidPrice === undefined ? null : product.actualWeightGrams > 0
      ? product.paidPrice * 1000 / product.actualWeightGrams
      : product.paidPrice / product.quantity;
    if (unitPrice !== null && unitPrice > 99999999.9999) fail("Stored unit price is out of range", "INVALID_STAGED_PRODUCT_PRICE");
  }
  if ((staged.currencyCode !== null && !/^[A-Z]{3}$/.test(staged.currencyCode)) ||
    (staged.totalSpent !== null && (!Number.isFinite(staged.totalSpent) || staged.totalSpent < 0 || staged.totalSpent > 9999999999.99)) ||
    ![null, "receipt_total", "line_items"].includes(staged.totalSpentSource)) {
    fail("Stored receipt spending data is invalid", "INVALID_STAGED_SPENDING");
  }
  if (staged.totalItems !== onchain.totalItems || staged.healthyItems !== onchain.healthyItems || staged.unhealthyItems !== onchain.unhealthyItems ||
    staged.fruitVegGrams !== onchain.fruitVegGrams || staged.householdSize !== onchain.householdSize || staged.daysCovered !== onchain.daysCovered ||
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
    if (body.userAddress.toLowerCase() !== onchain.userAddress.toLowerCase() || body.receiptHash.toLowerCase() !== onchain.receiptHash.toLowerCase()) {
      throw new VerifiedReceiptError("Receipt identity does not match the on-chain transaction", 422, "PAYLOAD_IDENTITY_MISMATCH");
    }
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

    const stagedRow = await client.query<{ payload: StagedReceiptAnalysis }>(
      `SELECT payload FROM receipt_analysis_staging
       WHERE lower(receipt_hash) = lower($1) AND lower(user_wallet) = lower($2) AND expires_at > NOW()
       FOR UPDATE`,
      [onchain.receiptHash, onchain.userAddress],
    );
    const staged = stagedRow.rows[0]?.payload;
    if (!staged) throw new VerifiedReceiptError("Receipt analysis expired; upload the receipt again", 409, "ANALYSIS_NOT_FOUND");
    assertPayloadMatchesChain(body, staged, onchain);

    const userId = user.rows[0]?.id;
    if (!userId) throw new Error("User record could not be created");
    const receipt = await client.query<{ id: string }>(
      `INSERT INTO receipts
       (user_id, receipt_hash, tx_hash, block_number, receipt_date, health_score, nutrition_score,
        total_items, detected_items, excluded_items, healthy_items, unhealthy_items, fruit_veg_grams,
       household_size, days_covered, points_earned, ocr_confidence, receipt_verification_confidence, builder_code_attributed,
       store_name, currency_code, total_spent, total_spent_source)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,1,$18,$19,$20,$21,$22)
       RETURNING id`,
      [userId, onchain.receiptHash, body.txHash, onchain.blockNumber, staged.receiptDate, onchain.healthScore,
        onchain.nutritionScore, onchain.totalItems, staged.products.length, staged.products.length - onchain.totalItems,
        onchain.healthyItems, onchain.unhealthyItems, onchain.fruitVegGrams, onchain.householdSize, onchain.daysCovered,
        onchain.pointsEarned, staged.ocrConfidence, onchain.builderCodeAttributed,
        staged.storeName, staged.currencyCode, staged.totalSpent, staged.totalSpentSource],
    );
    const receiptId = receipt.rows[0].id;
    const model = await client.query<{ id: string }>(
      `INSERT INTO model_versions (model_type, version, metadata) VALUES ('classifier', 'catalog-v1', '{"source":"backend-classifier"}')
       ON CONFLICT (model_type, version) DO UPDATE SET metadata = EXCLUDED.metadata RETURNING id`,
    );
    const canonicalKeys: Array<string | null> = [];
    for (const product of staged.products) {
      const normalized = normalizeProduct(product.name, product.category);
      const spendingCategory = getSpendingCategory(product.name, product.category === "excluded");
      canonicalKeys.push(normalized.canonicalKey);
      let canonicalProductId: string | null = null;
      if (normalized.canonicalKey) {
        const canonicalCategory = product.category === "excluded" ? "neutral" : product.category;
        const catalog = await client.query<{ id: string }>(
          `INSERT INTO canonical_products (canonical_key, display_name, category, default_fruit_veg_grams, spending_category)
           VALUES ($1,$2,$3,$4,$5)
           ON CONFLICT (canonical_key) DO UPDATE SET category = EXCLUDED.category,
             default_fruit_veg_grams = EXCLUDED.default_fruit_veg_grams,
             spending_category = EXCLUDED.spending_category
           RETURNING id`,
          [normalized.canonicalKey, product.name.trim(), canonicalCategory, product.fruitVegGrams, spendingCategory],
        );
        canonicalProductId = catalog.rows[0].id;
      }
      const quantity = Math.max(1, product.quantity);
      const weightGrams = Math.max(0, product.actualWeightGrams);
      const priceUnit = weightGrams > 0 ? "kg" : "each";
      const unitPrice = product.paidPrice === undefined ? null : weightGrams > 0
        ? product.paidPrice * 1000 / weightGrams
        : product.paidPrice / quantity;
      const item = await client.query<{ id: string }>(
        `INSERT INTO receipt_items
         (receipt_id, item_name, canonical_product_id, quantity, weight_grams, fruit_veg_grams, paid_price,
          unit_price, price_unit, spending_category, normalization_version, normalization_confidence)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'catalog-v1',$11) RETURNING id`,
        [receiptId, product.name.trim(), canonicalProductId, quantity, weightGrams, product.fruitVegGrams,
          product.paidPrice ?? null, unitPrice, priceUnit, spendingCategory, normalized.confidence],
      );
      await client.query(
        `INSERT INTO classifications (receipt_item_id, model_version_id, category, confidence, nutriscore)
         VALUES ($1,$2,$3,$4,$5)`,
        [item.rows[0].id, model.rows[0].id, product.category, product.confidence, product.nutriscore || null],
      );
    }
    for (const feature of buildDerivedFeatures(onchain, staged.products, canonicalKeys)) {
      await client.query(
        `INSERT INTO derived_features (receipt_id, feature_name, feature_value, calculation_version, confidence, metadata)
         VALUES ($1,$2,$3,'features-v1',$4,$5)
         ON CONFLICT (receipt_id, feature_name, calculation_version) DO UPDATE SET feature_value = EXCLUDED.feature_value,
           confidence = EXCLUDED.confidence, metadata = EXCLUDED.metadata`,
        [receiptId, feature.name, feature.value, feature.confidence, feature.metadata],
      );
    }
    await client.query("DELETE FROM receipt_analysis_staging WHERE lower(receipt_hash) = lower($1) AND lower(user_wallet) = lower($2)", [onchain.receiptHash, onchain.userAddress]);
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

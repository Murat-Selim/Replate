import { Router, Request, Response } from "express";
import { assertDatabaseConfigured, getDatabasePool } from "../db.js";
import { buildIntelligenceReport, IntelligenceFeatureSet } from "../services/intelligence-rules.js";
import { payerAddress, payerAddressFromHeader, paymentIdentifier, x402Configured } from "../services/x402.js";
import {
  buildBasketIntelligence,
  buildBehaviorIntelligence,
  buildBundle,
  buildProductPriceIntelligence,
  buildReceiptPriceAnalysis,
  buildRecommendations,
} from "../services/intelligence-data.js";

const router = Router();
const HASH = /^0x[a-fA-F0-9]{64}$/;
const ADDRESS = /^0x[a-fA-F0-9]{40}$/;

router.use((_req, res, next) => {
  if (!x402Configured) {
    res.status(503).json({ success: false, error: "x402 is not configured", errorCode: "X402_NOT_CONFIGURED" });
    return;
  }
  next();
});

function requestPayer(req: Request): string {
  const header = req.header("payment-signature") || req.header("x-payment") || "";
  return payerAddressFromHeader(header);
}

function assertPayer(req: Request): string {
  const payer = requestPayer(req);
  if (!ADDRESS.test(payer)) throw new Error("Payment payer could not be identified");
  return payer;
}


router.post("/advanced", async (req: Request, res: Response) => {
  try {
    const { receiptId, receiptHash, userAddress } = req.body as { receiptId?: string | number; receiptHash?: string; userAddress?: string };
    if (!/^\d+$/.test(String(receiptId || "")) || !HASH.test(receiptHash || "") || !ADDRESS.test(userAddress || "")) {
      res.status(400).json({ success: false, error: "receiptId, receiptHash and userAddress are required", errorCode: "INVALID_INTELLIGENCE_REQUEST" });
      return;
    }
    assertDatabaseConfigured();
    const client = await getDatabasePool().connect();
    try {
      const receipt = await client.query(
        `SELECT r.id, r.receipt_hash, u.wallet_address
         FROM receipts r JOIN users u ON u.id = r.user_id
         WHERE r.id = $1 AND r.receipt_hash = $2 AND lower(u.wallet_address) = lower($3)`,
        [String(receiptId), receiptHash, userAddress],
      );
      if (!receipt.rows[0]) {
        res.status(404).json({ success: false, error: "Verified receipt not found", errorCode: "RECEIPT_NOT_FOUND" });
        return;
      }
      const features = await client.query<{ feature_name: string; feature_value: string }>(
        "SELECT feature_name, feature_value FROM derived_features WHERE receipt_id = $1 AND calculation_version = 'features-v1'",
        [String(receiptId)],
      );
      const featureSet = Object.fromEntries(features.rows.map((row) => [row.feature_name, Number(row.feature_value)])) as unknown as IntelligenceFeatureSet;
      if (features.rows.length < 11) {
        res.status(409).json({ success: false, error: "Receipt intelligence features are not ready", errorCode: "FEATURES_NOT_READY" });
        return;
      }
      res.json({ success: true, receiptId: String(receiptId), report: buildIntelligenceReport(featureSet) });
    } finally {
      client.release();
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : "Internal server error" });
  }
});

router.post("/advanced/retry", async (req: Request, res: Response) => {
  try {
    const { receiptId, receiptHash } = req.body as { receiptId?: string | number; receiptHash?: string };
    const header = req.header("payment-signature") || req.header("x-payment") || "";
    if (!/^\d+$/.test(String(receiptId || "")) || !HASH.test(receiptHash || "") || !header) {
      res.status(400).json({ success: false, error: "receiptId, receiptHash and the original payment signature are required", errorCode: "INVALID_RETRY_REQUEST" });
      return;
    }
    let payload: unknown;
    try {
      payload = JSON.parse(Buffer.from(header, "base64").toString("utf8"));
    } catch {
      res.status(401).json({ success: false, error: "Invalid payment signature", errorCode: "INVALID_PAYMENT_SIGNATURE" });
      return;
    }
    const payer = payerAddress(payload);
    if (!ADDRESS.test(payer)) {
      res.status(401).json({ success: false, error: "Payment payer could not be identified", errorCode: "INVALID_PAYMENT_PAYER" });
      return;
    }
    assertDatabaseConfigured();
    const client = await getDatabasePool().connect();
    try {
      const entitlement = await client.query(
        `SELECT p.id, p.receipt_id, p.user_wallet, ir.report_status, ir.report_payload
         FROM x402_payments p
         LEFT JOIN intelligence_reports ir ON ir.payment_id = p.id
         WHERE p.payment_identifier = $1 AND p.receipt_id = $2 AND p.receipt_hash = $3
           AND lower(p.user_wallet) = lower($4) AND p.payment_status = 'settled'`,
        [paymentIdentifier(payload), String(receiptId), receiptHash, payer],
      );
      if (!entitlement.rows[0]) {
        res.status(403).json({ success: false, error: "No settled intelligence entitlement found", errorCode: "ENTITLEMENT_NOT_FOUND" });
        return;
      }
      if (entitlement.rows[0].report_status === "completed") {
        res.json({ success: true, receiptId: String(receiptId), report: entitlement.rows[0].report_payload, retried: false });
        return;
      }
      const features = await client.query<{ feature_name: string; feature_value: string }>(
        "SELECT feature_name, feature_value FROM derived_features WHERE receipt_id = $1 AND calculation_version = 'features-v1'",
        [String(receiptId)],
      );
      if (features.rows.length < 11) {
        res.status(409).json({ success: false, error: "Receipt intelligence features are not ready", errorCode: "FEATURES_NOT_READY" });
        return;
      }
      const featureSet = Object.fromEntries(features.rows.map((row) => [row.feature_name, Number(row.feature_value)])) as unknown as IntelligenceFeatureSet;
      const report = buildIntelligenceReport(featureSet);
      await client.query(
        `INSERT INTO intelligence_reports
         (receipt_id, payment_id, user_wallet, report_type, report_status, report_payload, rule_version, insight_confidence, completed_at)
         VALUES ($1,$2,$3,'advanced','completed',$4,$5,$6,NOW())
         ON CONFLICT (payment_id) DO UPDATE SET report_status = EXCLUDED.report_status,
           report_payload = EXCLUDED.report_payload, rule_version = EXCLUDED.rule_version,
           insight_confidence = EXCLUDED.insight_confidence, completed_at = EXCLUDED.completed_at`,
        [receiptId, entitlement.rows[0].id, payer, report, report.ruleVersion, report.insightConfidence],
      );
      res.json({ success: true, receiptId: String(receiptId), report, retried: true });
    } finally {
      client.release();
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : "Internal server error" });
  }
});

router.get("/basket/:receiptId", async (req: Request, res: Response) => {
  try {
    const payer = assertPayer(req);
    const receiptId = String(req.params.receiptId);
    if (!/^\d+$/.test(receiptId)) return res.status(400).json({ success: false, error: "Invalid receipt ID" });
    assertDatabaseConfigured();
    const client = await getDatabasePool().connect();
    try {
      const basket = await buildBasketIntelligence(client, receiptId, payer);
      if (!basket) return res.status(404).json({ success: false, error: "Verified receipt not found", errorCode: "RECEIPT_NOT_FOUND" });
      return res.json({ success: true, ...basket });
    } finally { client.release(); }
  } catch (error) { return res.status(500).json({ success: false, error: error instanceof Error ? error.message : "Internal server error" }); }
});

router.get("/price/receipt/:receiptId", async (req: Request, res: Response) => {
  try {
    const payer = assertPayer(req);
    const receiptId = String(req.params.receiptId);
    if (!/^\d+$/.test(receiptId)) return res.status(400).json({ success: false, error: "Invalid receipt ID" });
    assertDatabaseConfigured();
    const client = await getDatabasePool().connect();
    try {
      const price = await buildReceiptPriceAnalysis(client, receiptId, payer);
      if (!price) return res.status(404).json({ success: false, error: "Verified receipt not found", errorCode: "RECEIPT_NOT_FOUND" });
      return res.json({ success: true, ...price });
    } finally { client.release(); }
  } catch (error) { return res.status(500).json({ success: false, error: error instanceof Error ? error.message : "Internal server error" }); }
});

router.get("/price/product/:canonicalProductId", async (req: Request, res: Response) => {
  try {
    const productId = String(req.params.canonicalProductId);
    if (!/^\d+$/.test(productId)) return res.status(400).json({ success: false, error: "Invalid canonical product ID" });
    assertDatabaseConfigured();
    const client = await getDatabasePool().connect();
    try {
      const price = await buildProductPriceIntelligence(client, productId);
      if (!price) return res.status(404).json({ success: false, error: "Product price observations are not ready", errorCode: "PRICE_NOT_READY" });
      return res.json({ success: true, ...price });
    } finally { client.release(); }
  } catch (error) { return res.status(500).json({ success: false, error: error instanceof Error ? error.message : "Internal server error" }); }
});

router.get("/behavior/me", async (req: Request, res: Response) => {
  try {
    const payer = assertPayer(req);
    assertDatabaseConfigured();
    const client = await getDatabasePool().connect();
    try { return res.json({ success: true, ...(await buildBehaviorIntelligence(client, payer)) }); }
    finally { client.release(); }
  } catch (error) { return res.status(500).json({ success: false, error: error instanceof Error ? error.message : "Internal server error" }); }
});

router.get("/recommendation/:receiptId", async (req: Request, res: Response) => {
  try {
    const payer = assertPayer(req);
    const receiptId = String(req.params.receiptId);
    if (!/^\d+$/.test(receiptId)) return res.status(400).json({ success: false, error: "Invalid receipt ID" });
    assertDatabaseConfigured();
    const client = await getDatabasePool().connect();
    try {
      const recommendations = await buildRecommendations(client, receiptId, payer);
      if (!recommendations) return res.status(404).json({ success: false, error: "Verified receipt not found", errorCode: "RECEIPT_NOT_FOUND" });
      return res.json({ success: true, receiptId, recommendations });
    } finally { client.release(); }
  } catch (error) { return res.status(500).json({ success: false, error: error instanceof Error ? error.message : "Internal server error" }); }
});

router.post("/bundle", async (req: Request, res: Response) => {
  try {
    const payer = assertPayer(req);
    const receiptId = String(req.body?.receiptId || "");
    const include = Array.isArray(req.body?.include) ? req.body.include.filter((value: unknown): value is string => typeof value === "string") : [];
    if (!/^\d+$/.test(receiptId) || include.some((value: string) => !["basket", "price", "recommendation"].includes(value))) {
      return res.status(400).json({ success: false, error: "receiptId and valid include values are required" });
    }
    assertDatabaseConfigured();
    const client = await getDatabasePool().connect();
    try {
      const bundle = await buildBundle(client, receiptId, payer, include);
      if (!bundle) return res.status(404).json({ success: false, error: "Verified receipt not found", errorCode: "RECEIPT_NOT_FOUND" });
      return res.json({ success: true, ...bundle });
    } finally { client.release(); }
  } catch (error) { return res.status(500).json({ success: false, error: error instanceof Error ? error.message : "Internal server error" }); }
});

export default router;

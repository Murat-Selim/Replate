/** Offline receipt aggregation and x402 rejection checks. Uses only local mock servers and a fake database. */
import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import express from "express";
import { Pool } from "pg";

const owner = "0x1111111111111111111111111111111111111111";
const payTo = "0x2222222222222222222222222222222222222222";
const hash = `0x${"1".repeat(64)}`;
const fullItems = [
  ["BEBE BİSKÜVİSİ", 29.5, "unhealthy"], ["TEMİZLİK BEZİ", 40, "excluded"],
  ["EKMEK", 45, "neutral"], ["PATATES", 37.92, "healthy"],
  ["ŞEKER TOZ", 52.5, "unhealthy"], ["MEYVELİ İÇECEK EKŞİ ELMA", 55, "unhealthy"],
  ["BAR KAKAO KAPL.", 8.5, "unhealthy"], ["DOND. MAX", 15, "unhealthy"],
  ["DOND. MAX", 15, "unhealthy"], ["KEK ÇİLEK DOLGULU", 9.5, "unhealthy"],
  ["BAR KAKAO KAPL.", 8.5, "unhealthy"], ["MADEN SUYU SADE", 12, "neutral"],
].map(([name, price, category], index) => ({
  id: String(index + 1), item_name: name, paid_price: price as number | null, category,
  canonical_product_id: null, canonical_key: null, display_name: null,
  unit_price: price, quantity: 1, weight_grams: 0, price_unit: "each",
  spending_category: "other", normalization_confidence: 0.9,
}));

let items = fullItems;
let total = 328.42;
let source = "receipt_total";
let databaseFailure = false;
let settleCalls = 0;
const originalConnect = Pool.prototype.connect;
const originalQuery = Pool.prototype.query;

const query = async (sql: string) => {
  if (databaseFailure) throw new Error("test database unavailable");
  if (sql.includes("FROM receipts r JOIN users")) return { rows: [{
    id: "1", receipt_hash: hash, wallet_address: owner, health_score: 70, nutrition_score: 70,
    total_items: 11, fruit_veg_grams: 960, days_covered: 1, verified_at: "2026-10-08T10:00:00Z",
    currency_code: "TRY", store_name: "A101", total_spent: total, total_spent_source: source,
  }] };
  if (sql.includes("FROM receipt_items ri")) return { rows: items };
  if (sql.includes("COUNT(*)")) return { rows: [{ total_count: items.length, priced_count: items.filter((item) => item.paid_price !== null).length }] };
  if (sql.includes("SUM(paid_price)")) return { rows: [{ total: items.reduce((sum, item) => sum + (item.paid_price ?? 0), 0) }] };
  if (sql.includes("SET payment_status = 'settled'")) return { rows: [{ id: "1", receipt_id: "1", resource_type: "receipt_spending_breakdown", resource_id: "1" }] };
  return { rows: [] };
};

async function listen(server: Server) {
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert(address && typeof address !== "string");
  return `http://127.0.0.1:${address.port}`;
}

const facilitator = express();
facilitator.use(express.json());
facilitator.get("/supported", (_req, res) => res.json({
  kinds: [{ x402Version: 2, scheme: "exact", network: "eip155:8453" }],
  extensions: [], signers: { "eip155:8453": [payTo] },
}));
facilitator.post("/verify", (_req, res) => res.json({ isValid: true, payer: owner }));
facilitator.post("/settle", (_req, res) => {
  settleCalls++;
  res.json({ success: true, payer: owner, network: "eip155:8453", transaction: hash });
});
facilitator.post("/", (req, res) => {
  const result = (request: { id: number; method: string }) => ({ jsonrpc: "2.0", id: request.id, result: request.method === "eth_chainId" ? "0x2105" : null });
  res.json(Array.isArray(req.body) ? req.body.map(result) : result(req.body));
});
const facilitatorServer = createServer(facilitator);
let apiServer: Server | undefined;

try {
  const facilitatorUrl = await listen(facilitatorServer);
  // Override configuration before importing application modules; never use production credentials.
  process.env.NODE_ENV = "production";
  process.env.USE_OFF_API = "false";
  process.env.X402_PAY_TO = payTo;
  process.env.X402_FACILITATOR_URL = facilitatorUrl;
  process.env.X402_FACILITATOR_API_KEY = "";
  process.env.CDP_API_KEY_ID = "";
  process.env.CDP_API_KEY_SECRET = "";
  process.env.DATABASE_URL = "postgres://test@127.0.0.1/spending-test";
  process.env.DATABASE_SSL = "";
  process.env.RPC_URL = facilitatorUrl;
  Pool.prototype.connect = (async () => ({ query, release() {} })) as never;
  Pool.prototype.query = query as never;

  const { buildReceiptSpendingBreakdown } = await import("../server/services/intelligence-data.js");
  const breakdown = await buildReceiptSpendingBreakdown({ query } as never, "1", owner);
  assert(breakdown);
  assert.equal(breakdown.pricedItemsTotal, 328.42);
  assert.equal(breakdown.pricedItemCount, 12);
  assert.equal(breakdown.categories.length, 7);
  assert.equal(breakdown.categories[0].category, "drinks");
  assert.equal(breakdown.categories[0].amount, 67);
  assert.equal(breakdown.categories.find((item) => item.category === "household")?.amount, 40);
  console.log("OK: existing Other labels are reclassified, with 12 items totaling 328.42 TRY");

  const { createX402Middleware } = await import("../server/services/x402.js");
  const { default: intelligence } = await import("../server/routes/intelligence.js");
  console.log("Checking x402 rejection with the local mock facilitator");
  const app = express();
  const middleware = createX402Middleware();
  assert(middleware);
  app.use(middleware);
  app.use("/api/intelligence", intelligence);
  apiServer = createServer(app);
  const endpoint = `${await listen(apiServer)}/api/intelligence/spending/receipt/1`;
  const unpaid = await fetch(endpoint, { signal: AbortSignal.timeout(15000) });
  assert.equal(unpaid.status, 402);
  const header = unpaid.headers.get("payment-required");
  assert(header);
  const required = JSON.parse(Buffer.from(header, "base64").toString("utf8"));
  const payment = {
    x402Version: 2, resource: required.resource, accepted: required.accepts[0],
    payload: { signature: `0x${"0".repeat(130)}`, authorization: {
      from: owner, to: payTo, value: "50000", validAfter: "0", validBefore: "9999999999", nonce: `0x${"0".repeat(64)}`,
    } },
  };
  const paymentHeader = Buffer.from(JSON.stringify(payment)).toString("base64");
  const paidRequest = async (expected: RegExp) => {
    const response = await fetch(endpoint, { headers: { "payment-signature": paymentHeader }, signal: AbortSignal.timeout(15000) });
    const body = await response.json() as { success?: boolean; error?: string };
    assert(response.status >= 400, `unexpected HTTP ${response.status}`);
    assert.equal(body.success, false);
    assert.match(body.error || "", expected);
    assert.equal(settleCalls, 0, "invalid spending data must never reach facilitator settlement");
    console.log(`OK: ${body.error} — zero settlement calls`);
  };

  const partial = fullItems.filter((_item, index) => [1, 4, 5].includes(index)); // 40 + 52.50 + 55 = 147
  items = fullItems.map((item, index) => [1, 4, 5].includes(index) ? item : { ...item, paid_price: null });
  await paidRequest(/missing prices/);
  items = partial;
  await paidRequest(/do not match the printed receipt total/);
  total = 147;
  source = "line_items";
  await paidRequest(/printed receipt total could not be read/);
  databaseFailure = true;
  await paidRequest(/test database unavailable/);
  databaseFailure = false;
  items = fullItems;
  total = 328.42;
  source = "receipt_total";
  const validResponse = await fetch(endpoint, { headers: { "payment-signature": paymentHeader }, signal: AbortSignal.timeout(15000) });
  const validBody = await validResponse.json() as { success: boolean; pricedItemsTotal: number };
  assert.equal(validResponse.status, 200);
  assert.equal(validBody.success, true);
  assert.equal(validBody.pricedItemsTotal, 328.42);
  assert.equal(settleCalls, 1);
  console.log("OK: a complete receipt passes validation and reaches the mock settlement once");
  console.log("All receipt aggregation and payment checks passed.");
} finally {
  Pool.prototype.connect = originalConnect;
  Pool.prototype.query = originalQuery;
  apiServer?.closeAllConnections();
  facilitatorServer.closeAllConnections();
  await Promise.all([apiServer, facilitatorServer].filter(Boolean).map((server) => new Promise<void>((resolve) => server!.close(() => resolve()))));
}

/** Offline discovery, owner isolation and settlement checks. No real payment, database or model calls. */
import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import express from "express";
import { Pool } from "pg";
import { declareDiscoveryExtension, validateDiscoveryExtension } from "@x402/extensions";

const owner = `0x${"1".repeat(40)}`;
const stranger = `0x${"3".repeat(40)}`;
const payTo = `0x${"2".repeat(40)}`;
const hash = `0x${"1".repeat(64)}`;
const originalFetch = globalThis.fetch;
const originalConnect = Pool.prototype.connect;
const originalQuery = Pool.prototype.query;
globalThis.fetch = ((input: Parameters<typeof fetch>[0], init?: RequestInit) => {
  assert.match(String(input), /^http:\/\/127\.0\.0\.1:/, "offline checks cannot contact live services");
  return originalFetch(input, { ...init, signal: init?.signal ?? AbortSignal.timeout(15000) });
}) as typeof fetch;
let settlements = 0;
let failSettlement = false;
let rejectSignature = false;
let queries = 0;
let nonce = 0;
let registerStranger = false;
const payments = new Map<string, { id: string; receipt_id: unknown; resource_type: unknown; resource_id: unknown;
  user_wallet: unknown; payment_status: string; source_snapshot: unknown; source_commitment: unknown }>();
const features = { health_score: 75, nutrition_score: 72, healthy_item_ratio: 1, basket_diversity: 1,
  processed_food_ratio: 0, fruit_veg_ratio: 1, protein_ratio: 0, total_items: 1, healthy_items: 1, unhealthy_items: 0, fruit_veg_grams: 150 };
const query = async (sql: string, params: unknown[] = []) => {
  queries++;
  if (sql.includes("FROM receipts r JOIN users")) {
    if ((params[1] && params[1] !== owner) || (params[2] && params[2] !== hash) || params[0] !== "1") return { rows: [] };
    return { rows: [{ id: "1", receipt_hash: hash, wallet_address: owner, health_score: 75, nutrition_score: 72,
      total_items: 1, fruit_veg_grams: 150, days_covered: 1, verified_at: "2026-10-16T10:00:00Z",
      currency_code: "USD", store_name: "Synthetic private store", total_spent: 3, total_spent_source: "receipt_total" }] };
  }
  if (sql.includes("FROM receipt_items ri") && sql.includes("WHERE ri.receipt_id")) return { rows: [{
    id: "1", item_name: "Private example apple", category: "healthy", canonical_product_id: null, canonical_key: null,
    display_name: null, paid_price: 3, unit_price: 3, quantity: 1, weight_grams: 150, price_unit: "each",
    spending_category: "produce", normalization_confidence: 0.9,
  }] };
  if (sql.includes("SELECT COUNT(*) AS count FROM derived_features")) return { rows: [{ count: 11 }] };
  if (sql.includes("SELECT feature_name, feature_value")) return { rows: Object.entries(features).map(([feature_name, feature_value]) => ({ feature_name, feature_value })) };
  if (sql.includes("SELECT wallet_address FROM users")) return { rows: params[0] === owner || (registerStranger && params[0] === stranger) ? [{ wallet_address: params[0] }] : [] };
  if (sql.includes("AS total_count")) return { rows: [{ total_count: 1, priced_count: 1 }] };
  if (sql.includes("SUM(paid_price)")) return { rows: [{ total: 3 }] };
  if (sql.includes("SELECT p.source_commitment")) {
    const payment = payments.get(String(params[0]));
    return { rows: payment?.payment_status === "settled" ? [payment] : [] };
  }
  if (sql.includes("FROM x402_payments") && sql.includes("FOR UPDATE")) {
    const payment = payments.get(String(params[0]));
    return { rows: payment ? [payment] : [] };
  }
  if (sql.includes("INSERT INTO x402_payments")) {
    payments.set(String(params[8]), { id: String(payments.size + 1), receipt_id: params[0], user_wallet: params[2],
      resource_type: params[9], resource_id: params[10], source_commitment: params[12], source_snapshot: params[13], payment_status: "submitted" });
  }
  if (sql.includes("SET payment_status = 'settled'")) {
    const payment = payments.get(String(params[2]));
    assert(payment);
    payment.payment_status = "settled";
    return { rows: [payment] };
  }
  if (sql.includes("GROUP BY COALESCE")) {
    assert(sql.includes("WHERE lower(u.wallet_address) = lower($1)"));
    return { rows: params[0] === owner ? [{ item_name: "Private example apple", item_count: 2 }] : [] };
  }
  if (sql.includes("GROUP BY ri.spending_category") && sql.includes("LIMIT 5")) {
    assert(sql.includes("WHERE lower(u.wallet_address) = lower($1)"));
    return { rows: params[0] === owner ? [{ category: "produce", item_count: 2 }] : [] };
  }
  if (sql.includes("GROUP BY r.currency_code")) assert(sql.includes("WHERE lower(u.wallet_address) = lower($1)"));
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
  kinds: [{ x402Version: 2, scheme: "exact", network: "eip155:8453" }], extensions: [], signers: { "eip155:8453": [payTo] },
}));
facilitator.post("/verify", (req, res) => res.json(rejectSignature
  ? { isValid: false, invalidReason: "invalid_signature" }
  : { isValid: true, payer: req.body.paymentPayload?.payload?.authorization?.from || owner }));
facilitator.post("/settle", (_req, res) => {
  settlements++;
  res.json(failSettlement ? { success: false, errorReason: "test_settlement_failed", network: "eip155:8453", transaction: "" }
    : { success: true, payer: owner, network: "eip155:8453", transaction: hash });
});
facilitator.post("/", (req, res) => {
  const answer = (r: { id: number; method: string }) => ({ jsonrpc: "2.0", id: r.id, result: r.method === "eth_chainId" ? "0x2105" : null });
  res.json(Array.isArray(req.body) ? req.body.map(answer) : answer(req.body));
});
const facilitatorServer = createServer(facilitator);
let apiServer: Server | undefined;
try {
  const facilitatorUrl = await listen(facilitatorServer);
  Object.assign(process.env, { NODE_ENV: "production", USE_OFF_API: "false", X402_PAY_TO: payTo,
    X402_FACILITATOR_URL: facilitatorUrl, X402_FACILITATOR_API_KEY: "", CDP_API_KEY_ID: "", CDP_API_KEY_SECRET: "",
    DATABASE_URL: "postgres://test@127.0.0.1/bazaar-test", DATABASE_SSL: "", RPC_URL: facilitatorUrl, OCR_API_KEY: "" });
  Pool.prototype.connect = (async () => ({ query, release() {} })) as never;
  Pool.prototype.query = query as never;
  const { createX402Middleware } = await import("../server/services/x402.js");
  console.log("Loaded x402 middleware for offline Bazaar checks.");
  const { default: intelligence } = await import("../server/routes/intelligence.js");
  const { default: discovery } = await import("../server/routes/agent-discovery.js");
  const app = express();
  app.set("trust proxy", 1);
  app.use(express.json());
  app.use(createX402Middleware()!);
  app.use(discovery);
  app.use("/api/intelligence", intelligence);
  apiServer = createServer(app);
  const origin = await listen(apiServer);
  const spec = await (await fetch(origin + "/openapi.json")).json();
  const routes = [
    ["POST", "/api/intelligence/advanced", "100000"], ["GET", "/api/intelligence/basket/1", "40000"],
    ["GET", "/api/intelligence/price/receipt/1", "30000"], ["GET", "/api/intelligence/spending/receipt/1", "50000"],
    ["GET", "/api/intelligence/behavior/me", "50000"], ["GET", "/api/intelligence/spending/me", "50000"],
    ["POST", "/api/analyze-meal", "10000"],
  ];
  const advancedBody = { receiptId: "1", receiptHash: hash, userAddress: owner };
  const request = async (method: string, path: string, payer?: string, body?: unknown) => {
    const initial = await fetch(origin + path, { method, headers: { "x-forwarded-proto": "https" } });
    assert.equal(initial.status, 402);
    const required = JSON.parse(Buffer.from(initial.headers.get("payment-required")!, "base64").toString("utf8"));
    if (!payer) return { response: initial, required };
    const payment = { x402Version: 2, resource: required.resource, accepted: required.accepts[0], extensions: required.extensions,
      payload: { signature: `0x${"0".repeat(130)}`, authorization: { from: payer, to: payTo, value: required.accepts[0].amount,
        validAfter: "0", validBefore: "9999999999", nonce: `0x${(++nonce).toString(16).padStart(64, "0")}` } } };
    const response = await fetch(origin + path, { method, headers: { "Content-Type": "application/json",
      "x-forwarded-proto": "https", "payment-signature": Buffer.from(JSON.stringify(payment)).toString("base64") },
      body: body ? JSON.stringify(body) : undefined });
    return { response, required };
  };

  // Reproduces a deadlock if the handler demands settlement before x402 can settle its response.
  const advanced = await request("POST", "/api/intelligence/advanced", owner, advancedBody);
  const advancedResult = await advanced.response.json() as { report?: { recommendations?: unknown[] }; error?: string };
  assert.equal(advanced.response.status, 200, `first advanced call must reach settlement: ${advancedResult.error}`);
  assert(Array.isArray(advancedResult.report?.recommendations));
  assert.equal(settlements, 1);
  assert.equal(advanced.response.headers.get("cache-control"), "private, no-store");
  for (const [payer, body] of [
    [stranger, { ...advancedBody, userAddress: stranger }],
    [owner, { ...advancedBody, receiptHash: `0x${"2".repeat(64)}` }],
    [stranger, advancedBody],
  ] as const) {
    const before: number = settlements;
    const denied = await request("POST", "/api/intelligence/advanced", payer, body);
    assert(denied.response.status >= 400);
    assert(!JSON.stringify(await denied.response.json()).includes("Private example apple"));
    assert.equal(settlements, before, "advanced ownership, hash and payer mismatches cannot settle");
  }

  for (const [method, path, amount] of routes) {
    const beforeQueries = queries;
    const { required } = await request(method, path);
    assert.equal(queries, beforeQueries, "unsigned discovery cannot read private data");
    assert.equal(required.x402Version, 2);
    assert.equal(required.accepts[0].amount, amount);
    assert.equal(required.accepts[0].network, "eip155:8453");
    assert.equal(required.accepts[0].payTo, payTo);
    assert.match(required.resource.url, /^https:/);
    assert(required.extensions["builder-code"], "all payment routes preserve builder attribution");
    const bazaar = required.extensions.bazaar;
    if (path === "/api/analyze-meal") {
      assert(bazaar);
      assert.equal(bazaar.info.input.method, method);
      const valid = validateDiscoveryExtension(bazaar);
      assert(valid.valid, JSON.stringify(valid.errors));
    } else assert.equal(bazaar, undefined, "private resources are excluded from Bazaar discovery");
    assert(!JSON.stringify(required).includes("Private example apple"));
  }
  for (const path of ["/api/intelligence/basket/1", "/api/intelligence/price/receipt/1", "/api/intelligence/spending/receipt/1", "/api/intelligence/behavior/me", "/api/intelligence/spending/me"]) {
    const before: number = settlements;
    const denied = await request("GET", path, stranger);
    assert(denied.response.status >= 400);
    assert(!JSON.stringify(await denied.response.json()).includes("Private example apple"));
    assert.equal(settlements, before, "another wallet cannot pay to read the owner's data");
    const allowed = await request("GET", path, owner);
    const body = await allowed.response.json();
    assert.equal(allowed.response.status, 200, `${path}: ${JSON.stringify(body)}`);
    assert.equal(allowed.response.headers.get("cache-control"), "private, no-store");
    const routePath = path.replace(/\/1$/, "/{receiptId}");
    const schema = spec.paths[routePath].get.responses["200"].content["application/json"].schema;
    const bazaar = declareDiscoveryExtension({ output: { schema, example: body } }).bazaar;
    assert(bazaar.info.input.type === "http");
    bazaar.info.input.method = "GET";
    const valid = validateDiscoveryExtension(bazaar);
    assert(valid.valid, JSON.stringify(valid.errors));
    assert.equal(settlements, before + 1);
  }
  registerStranger = true;
  for (const path of ["/api/intelligence/behavior/me", "/api/intelligence/spending/me"]) {
    const ownHistory = await request("GET", path, stranger);
    const body = await ownHistory.response.json();
    assert.equal(ownHistory.response.status, 200);
    assert(!JSON.stringify(body).includes("Private example apple"));
    if (path.includes("behavior")) assert.deepEqual(body.purchaseFrequency, {});
    else assert.deepEqual(body.currencies, []);
  }
  const beforeInvalid = settlements;
  rejectSignature = true;
  const beforeInvalidQueries = queries;
  const forged = await request("GET", "/api/intelligence/price/receipt/1", owner);
  assert.equal(forged.response.status, 402);
  assert.equal(queries, beforeInvalidQueries, "failed signature verification never reaches private queries");
  rejectSignature = false;
  assert.equal(settlements, beforeInvalid);
  failSettlement = true;
  const failed = await request("GET", "/api/intelligence/price/receipt/1", owner);
  assert(failed.response.status >= 400);
  assert(!JSON.stringify(await failed.response.json()).includes("Private example apple"), "settlement failure discards the buffered private response");
  const failedAdvanced = await request("POST", "/api/intelligence/advanced", owner, advancedBody);
  assert(failedAdvanced.response.status >= 400);
  assert(!JSON.stringify(await failedAdvanced.response.json()).includes("Private example apple"));
  const manifest = await (await fetch(origin + "/.well-known/agent.json")).json();
  const card = await (await fetch(origin + "/.well-known/agent-card.json")).json();
  assert.deepEqual(manifest.endpoints.map((endpoint: { path: string }) => endpoint.path), ["/api/analyze-meal"]);
  assert.deepEqual(card.skills.map((skill: { id: string }) => skill.id), ["mealAnalysis"]);
  assert.equal(card.x402.amountAtomic, "10000");
  assert.equal(spec.paths["/api/analyze-meal"].post["x-bazaar-discoverable"], true);
  for (const [method, path] of routes.filter(([, path]) => path !== "/api/analyze-meal")) {
    assert.equal(spec.paths[path.replace(/\/1$/, "/{receiptId}")][method.toLowerCase()]["x-bazaar-discoverable"], false);
  }
  assert(spec.paths["/api/intelligence/advanced"].post.responses["200"].content["application/json"].schema.properties.report.properties.recommendations);
  assert(!Object.keys(spec.paths).some((path) => /recommendations?$/.test(path)), "no removed recommendation route is invented");
  console.log("Bazaar checks passed: only Meal is advertised, all seven paid routes work, private owner isolation and settlement checks pass.");
} finally {
  globalThis.fetch = originalFetch;
  Pool.prototype.connect = originalConnect;
  Pool.prototype.query = originalQuery;
  apiServer?.closeAllConnections();
  facilitatorServer.closeAllConnections();
  await Promise.all([apiServer, facilitatorServer].filter(Boolean).map((server) => new Promise<void>((resolve) => server!.close(() => resolve()))));
}

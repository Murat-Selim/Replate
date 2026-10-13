/** Offline schema-reader and financial validation checks; no external OCR, model or payments. */
import assert from "node:assert/strict";
import { createServer } from "node:http";
import express from "express";
import { Pool } from "pg";
import { ImageAnnotatorClient } from "@google-cloud/vision";
import { assertReliableReceiptAnalysis, receiptPriceIssues, ReceiptAnalysisError } from "../server/services/receipt-analysis.js";
import { hasRepeatedItemLoop, matchQuantities, parseReceiptReading, readReceiptImage, RECEIPT_SCHEMA } from "../server/services/receipt-reader.js";
import { OCRError } from "../server/services/ocr.js";

type Item = { name: string; totalPrice: number; discount?: number; category?: string; health?: string; alcohol?: boolean; fruitVeg?: boolean };
type Quantity = { quantity: number; unit: string; unitPrice: number };
const reading = (items: Item[], extra: Record<string, unknown> = {}, quantities: Quantity[] = []) => JSON.stringify({
  readable: true, merchant: "Test Market", currency: "TRY", basketDiscount: 0, subtotal: null, addedTax: null,
  total: items.reduce((sum, item) => sum + item.totalPrice - (item.discount ?? 0), 0),
  items: items.map((item) => ({ discount: 0, category: "pantry", health: "neutral", alcohol: false, fruitVeg: false, ...item })),
  quantities, ...extra,
});

const prices = { totalLineItemCount: 10, pricedItemCount: 10, pricedItemsTotal: 100, receiptTotal: 100, totalSpentSource: "receipt_total" as const };
assert.deepEqual(receiptPriceIssues(prices), []);
assert(receiptPriceIssues({ ...prices, pricedItemCount: 9 }).some((issue) => /missing prices/.test(issue)), "90% price coverage must be rejected");
assert(receiptPriceIssues({ ...prices, pricedItemsTotal: 99 }).length, "a 1% mismatch must be rejected");
assert.deepEqual(receiptPriceIssues({ ...prices, pricedItemsTotal: 100.01 }), [], "one cent rounding is supported");
assert(receiptPriceIssues({ ...prices, totalSpentSource: "line_items" }).length, "summing extracted products cannot prove completeness");
assert(receiptPriceIssues({ ...prices, receiptTotal: null }).length);
assert(receiptPriceIssues({ ...prices, pricedItemsTotal: NaN }).length);
assert(receiptPriceIssues({ ...prices, expectedItemsTotal: NaN }).length);

// Onur Market prints the weight line above its product; Lidl prints it below. Neither association comes from the model.
const onur = parseReceiptReading(reading([
  { name: "ONUR BEREKET TU", totalPrice: 70 },
  { name: "M PATLICAN KEME", totalPrice: 53.54, category: "produce", health: "healthy", fruitVeg: true },
  { name: "ONUR ALISVERIS", totalPrice: 3, category: "household" },
  { name: "EKMEK NORMAL", totalPrice: 30, category: "bakery" },
  { name: "SAYGIN HIMALAYA", totalPrice: 120, discount: 25 },
], {}, [{ quantity: 0.776, unit: "kg", unitPrice: 69 }, { quantity: 3, unit: "piece", unitPrice: 1 }, { quantity: 2, unit: "piece", unitPrice: 15 }]));
assert.deepEqual(onur.classification.products.map((product) => [product.paidPrice, product.quantity, product.actualWeightGrams, product.category]),
  [[70, 1, 0, "neutral"], [53.54, 1, 776, "healthy"], [3, 3, 0, "excluded"], [30, 2, 0, "neutral"], [95, 1, 0, "neutral"]]);
assert.equal(onur.classification.fruitVegGrams, 776, "printed weight is the fruit and vegetable amount");
assert.equal(onur.classification.excludedItems, 1, "shopping bags are not food");
assertReliableReceiptAnalysis(onur);
const lidl = parseReceiptReading(reading([
  { name: "TOMATE DE CACHO", totalPrice: 0.8, category: "produce", health: "healthy", fruitVeg: true },
  { name: "AMEIXA RAIN.CLA.EMB.", totalPrice: 1.99, category: "produce", health: "healthy", fruitVeg: true },
  { name: "AGUA DE NASCENTE", totalPrice: 1.74, category: "drinks", health: "healthy" },
], { currency: "EUR" }, [{ quantity: 0.54, unit: "kg", unitPrice: 1.49 }, { quantity: 6, unit: "piece", unitPrice: 0.29 }]));
assert.deepEqual(lidl.classification.products.map((product) => [product.actualWeightGrams, product.quantity, product.fruitVegGrams]),
  [[540, 1, 540], [0, 1, 150], [0, 6, 0]], "unweighed produce falls back to one typical piece");
const wine = parseReceiptReading(reading([{ name: "BRANCO REG RIBATEJO", totalPrice: 2.58, category: "drinks", health: "neutral", alcohol: true }], { currency: "EUR" }));
assert.equal(wine.classification.products[0].category, "unhealthy", "alcohol is unhealthy even when the health label disagrees");
assert.equal(wine.classification.unhealthyItems, 1);
assert.deepEqual(matchQuantities([5, 5], [{ quantity: 2, unit: "piece", unitPrice: 2.5 }, { quantity: 0.5, unit: "kg", unitPrice: 10 }]).map((measure) => measure?.unit),
  ["piece", "kg"], "products with the same amount take quantity lines in printed order");
assert.deepEqual(matchQuantities([10], [{ quantity: 3, unit: "piece", unitPrice: 2 }]), [undefined], "a line that reproduces no amount is dropped");

const basket = parseReceiptReading(reading([{ name: "ELMA", totalPrice: 6 }, { name: "SUT", totalPrice: 4 }], { basketDiscount: 1, total: 9 }));
assert.deepEqual(basket.classification.products.map((product) => product.paidPrice), [5.4, 3.6], "basket discounts are spread over items in cents");
assertReliableReceiptAnalysis(basket);
const salesTax = parseReceiptReading(reading([{ name: "APPLE", totalPrice: 5 }, { name: "BREAD", totalPrice: 3 }], { currency: "USD", subtotal: 8, addedTax: 0.66, total: 8.66 }));
assert.equal(salesTax.metadata.expectedItemsTotal, 8, "added sales tax compares items with the subtotal");
assertReliableReceiptAnalysis(salesTax);
const includedTax = parseReceiptReading(reading([{ name: "SOGAN", totalPrice: 64.23 }, { name: "SU", totalPrice: 66.5 }], { subtotal: 129.43, addedTax: 1.3, total: 130.73 }));
assert.equal(includedTax.metadata.expectedItemsTotal, null, "KDV already inside the prices never turns the subtotal into the target");
assertReliableReceiptAnalysis(includedTax);
assert.throws(() => assertReliableReceiptAnalysis(parseReceiptReading(reading([{ name: "APPLE", totalPrice: 5 }], { total: 8 }))), ReceiptAnalysisError, "a missing product fails the total check");
assert.throws(() => assertReliableReceiptAnalysis(parseReceiptReading(reading([{ name: "APPLE", totalPrice: 5 }], { currency: null }))), ReceiptAnalysisError);
assert.throws(() => parseReceiptReading(reading([{ name: "APPLE", totalPrice: 5, discount: 6 }])), ReceiptAnalysisError, "a discount above its price is not a reading");
assert.throws(() => parseReceiptReading(reading([{ name: "APPLE", totalPrice: 5, category: "other" }])), ReceiptAnalysisError, "every product needs a known category");
assert.throws(() => parseReceiptReading(reading([{ name: "MELON", totalPrice: 5 }], {}, [{ quantity: 60, unit: "kg", unitPrice: 5 / 60 }])), ReceiptAnalysisError);
assert.throws(() => parseReceiptReading(JSON.stringify({ readable: false, items: [] })), (error: unknown) => error instanceof OCRError && error.code === "OCR_INVALID_INPUT");
assert.throws(() => parseReceiptReading("{\"items\": ["), OCRError);
assert.equal(hasRepeatedItemLoop(JSON.stringify({ items: Array(3).fill({ name: "ELMA", totalPrice: 5 }) })), false, "a few repeated purchases are not a loop");
assert.equal(hasRepeatedItemLoop(JSON.stringify({ items: Array(10).fill({ name: "1X100 GR", totalPrice: 1.75 }) })), true, "one item repeated over and over is an invented reading");
assert.equal(RECEIPT_SCHEMA.properties.items.items.properties.category.enum.includes("other" as never), false, "the model cannot leave a product uncategorised");
console.log("Schema reader parsing and price validation checks passed.");

const originalFetch = globalThis.fetch;
const originalOCRKey = process.env.OCR_API_KEY;
const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.alloc(100, 1)]).toString("base64");
const otherJpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.alloc(100, 2)]).toString("base64");
const goodReading = reading([{ name: "APPLE", totalPrice: 5, category: "produce", health: "healthy", fruitVeg: true }, { name: "BREAD", totalPrice: 3, category: "bakery" }], { total: 8 },
  [{ quantity: 2, unit: "piece", unitPrice: 2.5 }]);
const badReading = reading([{ name: "APPLE", totalPrice: 5 }], { total: 8 });
let providerStatus = 200;
let providerContent = goodReading;
let providerFinish = "stop";
let providerCalls = 0;
let providerFailure = false;
globalThis.fetch = (async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
  const url = String(input);
  if (url.startsWith("https://api.doubleword.ai/")) {
    assert.equal(url, "https://api.doubleword.ai/v1/chat/completions");
    assert.equal(new Headers(init?.headers).get("Authorization"), "Bearer offline-test-key");
    assert.equal(init?.redirect, "error");
    assert(init?.signal, "provider calls have a deadline");
    providerCalls++;
    const request = JSON.parse(String(init?.body));
    assert.equal(request.model, "Qwen/Qwen3.6-35B-A3B-FP8");
    assert.equal(request.reasoning_effort, "none");
    assert.equal(request.temperature, 0);
    assert.equal(request.service_tier, "priority");
    assert.equal(request.stream, true);
    assert.equal(request.response_format.type, "json_schema");
    assert.equal(request.response_format.json_schema.strict, true);
    assert.deepEqual(request.response_format.json_schema.schema, JSON.parse(JSON.stringify(RECEIPT_SCHEMA)));
    assert.equal(request.messages.length, 1, "one prompt reads the whole receipt");
    assert.equal(request.messages[0].content[0].type, "text");
    assert.match(request.messages[0].content[1].image_url.url, /^data:image\/(?:jpeg|png|webp);base64,/);
    if (providerFailure) throw new Error("offline-test-key private image data");
    const events = [
      { choices: [{ delta: { role: "assistant", content: providerContent }, finish_reason: null }] },
      { choices: [{ delta: {}, finish_reason: providerFinish }] },
    ].map((event) => `data: ${JSON.stringify(event)}\n\n`).join("") + "data: [DONE]\n\n";
    return new Response(events, { status: providerStatus, headers: { "Content-Type": "text/event-stream" } });
  }
  assert.match(url, /^http:\/\/127\.0\.0\.1:/, "tests must never contact a live service");
  return originalFetch(input, init);
}) as typeof fetch;

const originalVision = ImageAnnotatorClient.prototype.batchAnnotateImages;
const originalQuery = Pool.prototype.query;
const visionLines = ["TEST MARKET", "APPLE 5.00", "BREAD 3.00", "TOTAL 8.00"];
let stagedWrites = 0;
let chainWrites = 0;
let chainReads = 0;
const rpc = express();
rpc.use(express.json());
rpc.post("/", (req, res) => {
  const answer = (request: { id: number; method: string }) => {
    chainReads++;
    if (!["eth_chainId", "eth_call"].includes(request.method)) chainWrites++;
    return { jsonrpc: "2.0", id: request.id, result: request.method === "eth_chainId" ? "0x2105" : `0x${"0".repeat(64)}` };
  };
  res.json(Array.isArray(req.body) ? req.body.map(answer) : answer(req.body));
});
const rpcServer = createServer(rpc);
const app = express();
app.use(express.json());
const apiServer = createServer(app);
async function listen(server: typeof apiServer) {
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert(address && typeof address !== "string");
  return `http://127.0.0.1:${address.port}`;
}
try {
  delete process.env.OCR_API_KEY;
  await assert.rejects(readReceiptImage(jpeg), OCRError);
  assert.equal(providerCalls, 0, "no key means no provider request");
  process.env.OCR_API_KEY = "offline-test-key";
  const direct = await readReceiptImage(jpeg);
  assert.equal(direct.metadata.totalSpent, 8);
  assert.equal(direct.classification.products[0].quantity, 2);
  assert.equal(direct.method, "model-schema");
  const beforeInvalidImage = providerCalls;
  await assert.rejects(readReceiptImage(Buffer.alloc(100, 1).toString("base64")), OCRError);
  await assert.rejects(readReceiptImage(Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.alloc(530000, 1)]).toString("base64")), OCRError);
  assert.equal(providerCalls, beforeInvalidImage, "unsupported photos never reach the provider");
  providerFinish = "length";
  await assert.rejects(readReceiptImage(jpeg), OCRError, "a truncated reading must not be used");
  providerFinish = "stop";
  providerContent = JSON.stringify({ items: Array(10).fill({ name: "X", totalPrice: 1 }) });
  await assert.rejects(readReceiptImage(jpeg), (error: unknown) => error instanceof OCRError && error.code === "OCR_INVALID_INPUT", "a looping model is stopped");
  providerContent = goodReading;
  for (const status of [401, 402, 413, 429, 500]) {
    providerStatus = status;
    await assert.rejects(readReceiptImage(jpeg), OCRError);
  }
  providerStatus = 200;
  providerFailure = true;
  await assert.rejects(readReceiptImage(jpeg), (error: unknown) => error instanceof OCRError && !/offline-test-key|private image/.test(error.message));
  providerFailure = false;
  delete process.env.OCR_API_KEY;
  console.log("Provider checks passed: structured request, truncation, loops and provider failures.");

  process.env.RPC_URL = await listen(rpcServer);
  process.env.NODE_ENV = "production";
  process.env.GOOGLE_CREDENTIALS_JSON = "{}";
  process.env.DATABASE_URL = "postgres://test@127.0.0.1/receipt-test";
  const { createReceiptHash } = await import("../server/services/receipt-hash.js");
  ImageAnnotatorClient.prototype.batchAnnotateImages = (async () => [{ responses: [{
    fullTextAnnotation: { text: [...visionLines, "DATE 09/10/2026"].join("\n"), pages: [{ confidence: 0.95 }] },
  }] }]) as never;
  const staging = new Map<string, { doublewordJob?: Record<string, unknown>; [key: string]: unknown }>();
  Pool.prototype.query = (async (sql: string, params: unknown[]) => {
    const key = JSON.stringify(params?.slice(0, 2));
    if (sql.startsWith("SELECT payload")) {
      const payload = staging.get(key);
      return { rows: payload ? [{ payload: structuredClone(payload) }] : [] };
    }
    if (sql.startsWith("UPDATE receipt_analysis_staging")) {
      const payload = staging.get(key);
      if (payload) payload.doublewordJob = JSON.parse(String(params[2]));
      return { rows: [] };
    }
    if (sql.includes("INSERT INTO receipt_analysis_staging")) {
      const isClaim = sql.includes("RETURNING payload");
      const existingJob = staging.get(key)?.doublewordJob;
      if (isClaim && existingJob && !(params[3] === true && existingJob.status === "failed")) return { rows: [] };
      const payload = structuredClone(params[2]) as { doublewordJob?: Record<string, unknown> };
      staging.set(key, payload);
      if (!isClaim) stagedWrites++;
      return { rows: isClaim ? [{ payload }] : [] };
    }
    return { rows: [] };
  }) as never;
  const { default: verifyReceipt } = await import("../server/routes/verify-receipt.js");
  // Config loads .env during import; live credentials must never enter the mock tests.
  process.env.OCR_API_KEY = "offline-test-key";
  app.use("/api/verify-receipt", verifyReceipt);
  const url = `${await listen(apiServer)}/api/verify-receipt`;
  const body = { imageBase64: jpeg, userAddress: `0x${"1".repeat(40)}`, householdSize: 1, onlyAnalyze: true };
  const post = (payload: unknown = body) => fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload), signal: AbortSignal.timeout(15000) });

  providerContent = badReading;
  const rejected = await post();
  const rejectedBody = await rejected.json() as { success: boolean; errorCode: string; data?: unknown };
  assert.equal(rejected.status, 422);
  assert.equal(rejectedBody.errorCode, "RECEIPT_ANALYSIS_UNRELIABLE");
  assert.equal(rejectedBody.data, undefined);
  assert.equal(stagedWrites, 0, "bad receipt cannot be staged for a wallet transaction");
  assert.equal(chainWrites, 0);
  assert(chainReads > 0, "duplicate checks use the local fake RPC");
  const callsAfterFailure = providerCalls;
  assert.equal((await post()).status, 502, "the same photo replays its failed reading");
  assert.equal(providerCalls, callsAfterFailure, "a failed reading of the same photo is not paid for again");

  providerContent = goodReading;
  const accepted = await post({ ...body, imageBase64: otherJpeg });
  const acceptedBody = await accepted.json() as { data: { txHash: string; totalSpent: number; receiptHash: string; analysisMethod: string; ocrConfidence: number; products: Array<{ quantity: number; spendingCategory: string }> } };
  assert.equal(accepted.status, 200, "a new photo of a failed receipt is read again");
  assert.equal(providerCalls, callsAfterFailure + 1);
  assert.equal(acceptedBody.data.totalSpent, 8);
  assert.equal(acceptedBody.data.txHash, "");
  assert.equal(acceptedBody.data.analysisMethod, "model-schema");
  assert.equal(acceptedBody.data.ocrConfidence, 0.95);
  assert.deepEqual(acceptedBody.data.products.map((product) => [product.quantity, product.spendingCategory]), [[2, "produce"], [1, "bakery"]]);
  assert.equal(acceptedBody.data.receiptHash, createReceiptHash([...visionLines, "DATE 09/10/2026"], "2026-10-09"), "Vision text stays the receipt identity");
  assert.equal(stagedWrites, 1);
  assert.equal(chainWrites, 0, "analysis never submits a chain transaction");
  const duplicate = await post({ ...body, imageBase64: otherJpeg });
  assert.equal(duplicate.status, 200);
  assert.equal(providerCalls, callsAfterFailure + 1, "duplicate uploads reuse the stored reading");

  staging.clear();
  providerStatus = 500;
  assert.equal((await post()).status, 502);
  providerStatus = 200;
  const beforeOutageRetry = providerCalls;
  assert.equal((await post()).status, 200, "a provider outage does not block the same photo");
  assert.equal(providerCalls, beforeOutageRetry + 1);

  const job = [...staging.values()][0].doublewordJob!;
  delete job.verificationResponse;
  job.status = "starting";
  const pending = { receiptHash: acceptedBody.data.receiptHash, token: String(job.token) };
  const poll = (payload: Record<string, unknown> = {}) => post({ onlyAnalyze: true, userAddress: body.userAddress, pendingAnalysis: pending, ...payload });
  assert.equal((await poll({ pendingAnalysis: { ...pending, token: "0".repeat(36) } })).status, 404);
  assert.equal((await poll({ userAddress: `0x${"2".repeat(40)}` })).status, 404);
  assert.equal((await poll()).status, 202, "a reading in progress elsewhere is awaited, not repeated");
  job.responseId = "resp_legacy";
  assert.equal((await poll()).status, 502, "background jobs from the Markdown reader expire");

  staging.clear();
  const beforeConcurrent = providerCalls;
  const concurrent = await Promise.all([1, 2].map(() => post()));
  assert(concurrent.every((response) => [200, 202].includes(response.status)));
  assert.equal(providerCalls, beforeConcurrent + 1, "concurrent uploads submit only one reading");
  assert.equal(chainWrites, 0);
  console.log("Verify endpoint checks passed: unreliable receipts cannot open verification; valid receipts are staged once.");
} finally {
  globalThis.fetch = originalFetch;
  if (originalOCRKey === undefined) delete process.env.OCR_API_KEY;
  else process.env.OCR_API_KEY = originalOCRKey;
  ImageAnnotatorClient.prototype.batchAnnotateImages = originalVision;
  Pool.prototype.query = originalQuery;
  apiServer.closeAllConnections();
  rpcServer.closeAllConnections();
  await Promise.all([apiServer, rpcServer].map((server) => new Promise<void>((resolve) => server.close(() => resolve()))));
}

/** Offline automatic recovery and financial validation checks; no external OCR or payments. */
import assert from "node:assert/strict";
import { createServer } from "node:http";
import express from "express";
import { Pool } from "pg";
import { ImageAnnotatorClient } from "@google-cloud/vision";
import { analyzeReceipt, receiptPriceIssues, ReceiptAnalysisError, type ReceiptAnalysis } from "../server/services/receipt-analysis.js";
import { classifyFoods } from "../server/services/classifier.js";
import { extractReceiptMetadata } from "../server/services/receipt-metadata.js";
import { novitaReceiptLines, readReceiptWithNovita } from "../server/services/novita-ocr.js";
import { OCRError } from "../server/services/ocr.js";

process.env.USE_OFF_API = "false";
const good = ["APPLE $5.00", "BREAD $3.00", "TOTAL $8.00"];
const partial = ["APPLE $5.00", "BREAD", "TOTAL $8.00"];
const result = { lines: good, analysisLines: good, fullText: good.join("\n"), confidence: 0.95 };
let recoveryCalls = 0;
const recover = async (): Promise<ReceiptAnalysis> => {
  recoveryCalls++;
  const classification = await classifyFoods(good);
  return { classification, metadata: extractReceiptMetadata(good, classification.products), method: "image-recovery" };
};

const primary = await analyzeReceipt(result, recover);
assert.equal(primary.method, "vision-layout");
assert.equal(recoveryCalls, 0, "a good receipt never invokes the secondary reader");
const textRecovered = await analyzeReceipt({ ...result, analysisLines: partial }, recover);
assert.equal(textRecovered.method, "vision-text");
assert.equal(recoveryCalls, 0, "a usable Vision text layout is recovered without a second OCR call");
await assert.rejects(analyzeReceipt({ ...result, lines: ["APPLE $3.00", "BREAD $5.00", "TOTAL $8.00"] }), ReceiptAnalysisError,
  "equal totals do not prove correct product-to-price matching when OCR layouts disagree");
await assert.rejects(analyzeReceipt({ ...result, confidence: 0.5 }), ReceiptAnalysisError);
const imageRecovered = await analyzeReceipt({ ...result, lines: partial, analysisLines: partial }, recover);
assert.equal(imageRecovered.method, "image-recovery");
assert.equal(recoveryCalls, 1, "one secondary read repairs a failed receipt");
await assert.rejects(analyzeReceipt({ ...result, lines: partial, analysisLines: partial }), ReceiptAnalysisError);
await assert.rejects(analyzeReceipt({ ...result, lines: partial, analysisLines: partial }, async () => ({
  ...imageRecovered, metadata: { ...imageRecovered.metadata, totalSpent: 9 },
})), ReceiptAnalysisError, "a secondary answer is still checked against its printed total");
await assert.rejects(analyzeReceipt({ ...result, lines: ["MYSTERY PRODUCT $8.00", "TOTAL $8.00"], analysisLines: undefined }), ReceiptAnalysisError,
  "unknown category is not presented as a reliable insight");

const prices = { totalLineItemCount: 10, pricedItemCount: 10, pricedItemsTotal: 100, receiptTotal: 100, totalSpentSource: "receipt_total" as const };
assert.deepEqual(receiptPriceIssues(prices), []);
assert(receiptPriceIssues({ ...prices, pricedItemCount: 9 }).some((issue) => /missing prices/.test(issue)), "90% price coverage must be rejected");
assert(receiptPriceIssues({ ...prices, pricedItemsTotal: 99 }).length, "a 1% mismatch must be rejected");
assert.deepEqual(receiptPriceIssues({ ...prices, pricedItemsTotal: 100.01 }), [], "one cent rounding is supported");
assert(receiptPriceIssues({ ...prices, totalSpentSource: "line_items" }).length, "summing extracted products cannot prove completeness");
assert(receiptPriceIssues({ ...prices, receiptTotal: null }).length);
assert(receiptPriceIssues({ ...prices, pricedItemsTotal: NaN }).length);
assert(receiptPriceIssues({ ...prices, expectedItemsTotal: NaN }).length);
const taxed = ["APPLE $5.00", "BREAD $3.00", "SUB TOTAL $8.00", "SALES TAX $0.66", "TOTAL $8.66"];
const taxedResult = await analyzeReceipt({ ...result, lines: taxed, analysisLines: taxed });
assert.equal(taxedResult.metadata.totalSpent, 8.66);
assert.equal(taxedResult.metadata.expectedItemsTotal, 8);
const badTax = ["APPLE $5.00", "BREAD $3.00", "SUB TOTAL $8.00", "SALES TAX $0.60", "TOTAL $8.66"];
await assert.rejects(analyzeReceipt({ ...result, lines: badTax, analysisLines: badTax }), ReceiptAnalysisError);
console.log("All automatic receipt recovery and price validation checks passed.");

const originalFetch = globalThis.fetch;
const originalNovitaKey = process.env.NOVITA_API_KEY;
const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.alloc(100, 1)]).toString("base64");
const markdown = "| Product | Qty | Unit Price | Amount |\n|---|---|---|---|\n| APPLE | 2 | $2.50 | $5.00 |\n| BREAD | 1 | $3.00 | $3.00 |\n| TOTAL | | | $8.00 |";
let providerStatus = 200;
let providerContent = markdown;
let providerFinish = "stop";
let providerCalls = 0;
let providerFailure = false;
globalThis.fetch = (async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
  const url = String(input);
  if (url === "https://api.novita.ai/openai/v1/chat/completions") {
    providerCalls++;
    assert.equal(new Headers(init?.headers).get("Authorization"), "Bearer offline-test-key");
    assert.equal(init?.redirect, "error");
    assert(init?.signal, "provider calls have a deadline");
    const request = JSON.parse(String(init?.body));
    assert.equal(request.model, "deepseek/deepseek-ocr-2");
    assert.equal(request.temperature, 0);
    assert.equal(request.top_k, 0);
    assert.equal(request.stream, false);
    assert.match(request.messages[0].content[0].image_url.url, /^data:image\/(?:jpeg|png|webp);base64,/);
    if (providerFailure) throw new Error("offline-test-key private image data");
    return new Response(JSON.stringify({ choices: [{ finish_reason: providerFinish, message: { content: providerContent } }] }), { status: providerStatus });
  }
  assert.match(url, /^http:\/\/127\.0\.0\.1:/, "tests must never contact a live service");
  return originalFetch(input, init);
}) as typeof fetch;

const originalVision = ImageAnnotatorClient.prototype.batchAnnotateImages;
const originalQuery = Pool.prototype.query;
let currentLines = partial;
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
  delete process.env.NOVITA_API_KEY;
  await assert.rejects(readReceiptWithNovita(jpeg), OCRError);
  assert.equal(providerCalls, 0, "no key means no provider request");
  process.env.NOVITA_API_KEY = "offline-test-key";
  const recovered = await analyzeReceipt({ ...result, lines: partial, analysisLines: partial }, () => readReceiptWithNovita(jpeg));
  assert.equal(recovered.metadata.totalSpent, 8);
  assert.equal(recovered.classification.products[0].quantity, 2, "explicit table quantity must survive OCR");
  assert.equal(providerCalls, 1);
  const weighted = novitaReceiptLines('<table><tr><th>Product Name</th><th>Quantity</th><th>Unit</th><th>VAT</th><th>Price</th><th>Amount</th></tr><tr><td>BREAD</td><td>1</td><td>ADET</td><td>1</td><td>55.00</td><td>55.00</td></tr><tr><td>PEPPER</td><td>0.4</td><td>KILO</td><td>1</td><td>49.99</td><td>20.00</td></tr><tr><td>TOMATO</td><td>0.83</td><td>KILO</td><td>1</td><td>19.99</td><td>16.59</td></tr></table>\nTOTAL 91.59 TL');
  const weightedProducts = await classifyFoods(weighted);
  assert.deepEqual(weightedProducts.products.map((product) => product.paidPrice), [55, 20, 16.59]);
  assert.deepEqual(weightedProducts.products.map((product) => product.actualWeightGrams), [0, 400, 830]);
  assert.equal(extractReceiptMetadata(weighted, weightedProducts.products).totalSpent, 91.59);
  assert.deepEqual(novitaReceiptLines('<|ref|>APPLE $5.00<|/ref|><|det|>[[0, 0, 10, 10]]\n**TOTAL** $5.00'), ["APPLE $5.00", "TOTAL $5.00"]);
  assert.throws(() => novitaReceiptLines("| Product | Qty | Amount |\n| APPLE | 0.5 | $5.00 |"), OCRError, "fractional quantity without a unit must not be guessed");
  assert.throws(() => novitaReceiptLines("| Product | Qty | Amount |\n| APPLE | two | $5.00 |"), OCRError);
  assert.throws(() => novitaReceiptLines("| Product | Qty | Amount |\n| APPLE | $5.00 |"), OCRError);
  const beforeInvalidImage = providerCalls;
  await assert.rejects(readReceiptWithNovita(Buffer.alloc(100, 1).toString("base64")), OCRError);
  assert.equal(providerCalls, beforeInvalidImage);
  providerFinish = "length";
  await assert.rejects(readReceiptWithNovita(jpeg), OCRError, "truncated OCR must not be used");
  providerFinish = "stop";
  providerContent = "";
  await assert.rejects(readReceiptWithNovita(jpeg), OCRError);
  providerContent = markdown;
  for (const status of [401, 429, 500]) {
    providerStatus = status;
    await assert.rejects(readReceiptWithNovita(jpeg), OCRError);
  }
  providerStatus = 200;
  providerFailure = true;
  await assert.rejects(readReceiptWithNovita(jpeg), (error: unknown) => error instanceof OCRError && !/offline-test-key|private image/.test(error.message));
  providerFailure = false;
  delete process.env.NOVITA_API_KEY;
  console.log("Novita offline checks passed: table prices, quantities, weights, truncation and provider failures.");
  process.env.RPC_URL = await listen(rpcServer);
  process.env.NODE_ENV = "production";
  process.env.GOOGLE_CREDENTIALS_JSON = "{}";
  process.env.DATABASE_URL = "postgres://test@127.0.0.1/receipt-test";
  const { createReceiptHash } = await import("../server/services/receipt-hash.js");
  ImageAnnotatorClient.prototype.batchAnnotateImages = (async () => [{ responses: [{
    fullTextAnnotation: { text: [...currentLines, "DATE 09/10/2026"].join("\n"), pages: [{ confidence: 0.95 }] },
  }] }]) as never;
  Pool.prototype.query = (async (sql: string) => {
    if (sql.includes("INSERT INTO receipt_analysis_staging")) stagedWrites++;
    return { rows: [] };
  }) as never;
  const { default: verifyReceipt } = await import("../server/routes/verify-receipt.js");
  app.use("/api/verify-receipt", verifyReceipt);
  const url = `${await listen(apiServer)}/api/verify-receipt`;
  const body = { imageBase64: jpeg, userAddress: `0x${"1".repeat(40)}`, householdSize: 1, onlyAnalyze: true };
  const rejected = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(15000) });
  const rejectedBody = await rejected.json() as { success: boolean; errorCode: string; data?: unknown };
  assert.equal(rejected.status, 422);
  assert.equal(rejectedBody.errorCode, "RECEIPT_ANALYSIS_UNRELIABLE");
  assert.equal(rejectedBody.data, undefined);
  assert.equal(stagedWrites, 0, "bad receipt cannot be staged for a wallet transaction");
  assert.equal(chainWrites, 0);
  assert(chainReads > 0, "duplicate checks use the local fake RPC");
  currentLines = good;
  const accepted = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(15000) });
  const acceptedBody = await accepted.json() as { success: boolean; data: { txHash: string; totalSpent: number } };
  assert.equal(accepted.status, 200);
  assert.equal(acceptedBody.data.totalSpent, 8);
  assert.equal(acceptedBody.data.txHash, "");
  assert.equal(stagedWrites, 1);
  assert.equal(chainWrites, 0, "analysis never submits a chain transaction");
  process.env.NOVITA_API_KEY = "offline-test-key";
  const callsBeforeGood = providerCalls;
  await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  assert.equal(providerCalls, callsBeforeGood, "valid Vision output never calls Novita even with its key enabled");
  currentLines = partial;
  const repaired = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const repairedBody = await repaired.json() as { data: { receiptHash: string; totalSpent: number; ocrConfidence: number; analysisMethod: string; products: Array<{ quantity: number }> } };
  assert.equal(repaired.status, 200);
  assert.equal(providerCalls, callsBeforeGood + 1);
  assert.equal(repairedBody.data.totalSpent, 8);
  assert.equal(repairedBody.data.products[0].quantity, 2);
  assert.equal(repairedBody.data.analysisMethod, "image-recovery");
  assert.equal(repairedBody.data.ocrConfidence, 0, "unknown provider confidence must not be invented");
  assert.equal(repairedBody.data.receiptHash, createReceiptHash([...partial, "DATE 09/10/2026"], "2026-10-09"), "recovery must preserve the original receipt identity");
  const writesBeforeBad = stagedWrites;
  providerContent = "APPLE $5.00\nBREAD\nTOTAL $8.00";
  const badRecovery = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  assert.equal(badRecovery.status, 422);
  assert.equal(stagedWrites, writesBeforeBad, "bad secondary results cannot reach the wallet");
  providerContent = markdown;
  providerFinish = "length";
  const truncatedRecovery = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  assert.equal(truncatedRecovery.status, 502);
  assert.equal(stagedWrites, writesBeforeBad);
  assert.equal(chainWrites, 0);
  console.log("Verify endpoint checks passed: unreliable receipts cannot open verification; valid receipts are staged once.");
} finally {
  globalThis.fetch = originalFetch;
  if (originalNovitaKey === undefined) delete process.env.NOVITA_API_KEY;
  else process.env.NOVITA_API_KEY = originalNovitaKey;
  ImageAnnotatorClient.prototype.batchAnnotateImages = originalVision;
  Pool.prototype.query = originalQuery;
  apiServer.closeAllConnections();
  rpcServer.closeAllConnections();
  await Promise.all([apiServer, rpcServer].map((server) => new Promise<void>((resolve) => server.close(() => resolve()))));
}

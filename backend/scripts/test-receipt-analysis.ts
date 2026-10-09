/** Offline automatic recovery and financial validation checks; no external OCR or payments. */
import assert from "node:assert/strict";
import { createServer } from "node:http";
import express from "express";
import { Pool } from "pg";
import { ImageAnnotatorClient } from "@google-cloud/vision";
import { analyzeReceipt, receiptPriceIssues, ReceiptAnalysisError, type ReceiptAnalysis } from "../server/services/receipt-analysis.js";
import { classifyFoods } from "../server/services/classifier.js";
import { extractReceiptMetadata } from "../server/services/receipt-metadata.js";
import { ocrReceiptLines, readReceiptWithDoubleword, pollReceiptWithDoubleword, OCRPendingError } from "../server/services/doubleword-ocr.js";
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
const originalOCRKey = process.env.OCR_API_KEY;
const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.alloc(100, 1)]).toString("base64");
const markdown = "| Product | Qty | Unit Price | Amount |\n|---|---|---|---|\n| APPLE | 2 | $2.50 | $5.00 |\n| BREAD | 1 | $3.00 | $3.00 |\n| TOTAL | | | $8.00 |";
let providerStatus = 200;
let providerContent = markdown;
let providerPhase = "completed";
let pollCalls = 0;
let providerCalls = 0;
let providerFailure = false;
globalThis.fetch = (async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
  const url = String(input);
  const realtime = url === "https://api.doubleword.ai/v1/chat/completions";
  if (realtime || url.startsWith("https://api.doubleword.ai/v1/responses")) {
    assert.equal(new Headers(init?.headers).get("Authorization"), "Bearer offline-test-key");
    assert.equal(init?.redirect, "error");
    assert(init?.signal, "provider calls have a deadline");
    if (init?.method === "POST") {
      assert(realtime, "new OCR requests use the realtime endpoint");
      providerCalls++;
      const request = JSON.parse(String(init.body));
      assert.equal(request.model, "Qwen/Qwen3-VL-30B-A3B-Instruct-FP8");
      assert.equal(request.temperature, 0);
      assert.equal(request.service_tier, "priority");
      assert.equal(request.background, undefined);
      assert.equal(request.stream, false);
      assert.equal(request.messages[0].content[0].type, "text");
      assert.equal(request.messages[0].content[1].type, "image_url");
      assert.match(request.messages[0].content[1].image_url.url, /^data:image\/(?:jpeg|png|webp);base64,/);
    } else {
      pollCalls++;
      assert.equal(url, "https://api.doubleword.ai/v1/responses/resp_test");
    }
    if (providerFailure) throw new Error("offline-test-key private image data");
    if (realtime) return new Response(JSON.stringify({ choices: [{ finish_reason: providerPhase === "completed" ? "stop" : "length",
      message: { role: "assistant", content: providerContent } }] }), { status: providerStatus });
    return new Response(JSON.stringify({ id: "resp_test", status: providerPhase,
      output: [{ type: "message", role: "assistant", content: [{ type: "output_text", text: providerContent }] }] }),
      { status: providerStatus });
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
  delete process.env.OCR_API_KEY;
  await assert.rejects(readReceiptWithDoubleword(jpeg), OCRError);
  assert.equal(providerCalls, 0, "no key means no provider request");
  process.env.OCR_API_KEY = "offline-test-key";
  const recovered = await analyzeReceipt({ ...result, lines: partial, analysisLines: partial }, () => readReceiptWithDoubleword(jpeg));
  assert.equal(recovered.metadata.totalSpent, 8);
  assert.equal(recovered.classification.products[0].quantity, 2, "explicit table quantity must survive OCR");
  assert.equal(providerCalls, 1);
  const weighted = ocrReceiptLines('<table><tr><th>Product Name</th><th>Quantity</th><th>Unit</th><th>VAT</th><th>Price</th><th>Amount</th></tr><tr><td>BREAD</td><td>1</td><td>ADET</td><td>1</td><td>55.00</td><td>55.00</td></tr><tr><td>PEPPER</td><td>0.4</td><td>KILO</td><td>1</td><td>49.99</td><td>20.00</td></tr><tr><td>TOMATO</td><td>0.83</td><td>KILO</td><td>1</td><td>19.99</td><td>16.59</td></tr></table>\nTOTAL 91.59 TL');
  const weightedProducts = await classifyFoods(weighted);
  assert.deepEqual(weightedProducts.products.map((product) => product.paidPrice), [55, 20, 16.59]);
  assert.deepEqual(weightedProducts.products.map((product) => product.actualWeightGrams), [0, 400, 830]);
  assert.equal(extractReceiptMetadata(weighted, weightedProducts.products).totalSpent, 91.59);
  assert.deepEqual(ocrReceiptLines('<|ref|>APPLE $5.00<|/ref|><|det|>[[0, 0, 10, 10]]\n**TOTAL** $5.00'), ["APPLE $5.00", "TOTAL $5.00"]);
  assert.throws(() => ocrReceiptLines("| Product | Qty | Amount |\n| APPLE | 0.5 | $5.00 |"), OCRError, "fractional quantity without a unit must not be guessed");
  assert.throws(() => ocrReceiptLines("| Product | Qty | Amount |\n| APPLE | two | $5.00 |"), OCRError);
  assert.throws(() => ocrReceiptLines("| Product | Qty | Amount |\n| APPLE | $5.00 |"), OCRError);
  const blankQuantities = await classifyFoods(ocrReceiptLines("| Product | Qty | Unit | Unit Price | Amount |\n| BREAD | | | | $3.00 |\n| Bean (Green) | .370 kg | kg | $4.39/kg | $1.62 |\n| SOGAN | 1.170 | TL/kg | | *64,23 |\n| DATE/TIME | SEP 23 2014 | | | |\n| FINAL TOTAL | | | | $68.85 |"));
  assert.deepEqual(blankQuantities.products.map((product) => product.paidPrice), [3, 1.62, 64.23]);
  assert.deepEqual(blankQuantities.products.map((product) => product.actualWeightGrams), [0, 370, 1170]);
  assert.throws(() => ocrReceiptLines("| Product | Qty | Unit | Amount |\n| APPLE | 0.5 kg | g | $5.00 |"), OCRError);
  const missingAmount = await classifyFoods(ocrReceiptLines("| Product | Qty | Unit Price | Amount |\n| APPLE | 2 | $2.50 | |\n| TOTAL | | | $2.50 |"));
  assert.equal(missingAmount.products[0].paidPrice, undefined, "missing line totals never fall back to a unit-price cell");
  providerPhase = "queued";
  await assert.rejects(pollReceiptWithDoubleword("resp_test"), OCRPendingError, "legacy background jobs still resume by ID");
  await assert.rejects(readReceiptWithDoubleword(jpeg), OCRError, "realtime must not accept a truncated completion");
  const beforePoll = providerCalls;
  providerPhase = "completed";
  assert.equal((await pollReceiptWithDoubleword("resp_test")).metadata.totalSpent, 8);
  assert.equal(providerCalls, beforePoll, "polling never creates a new OCR job");
  await assert.rejects(pollReceiptWithDoubleword("../other-job"), OCRError);
  const beforeInvalidImage = providerCalls;
  await assert.rejects(readReceiptWithDoubleword(Buffer.alloc(100, 1).toString("base64")), OCRError);
  await assert.rejects(readReceiptWithDoubleword(Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.alloc(530000, 1)]).toString("base64")), OCRError);
  assert.equal(providerCalls, beforeInvalidImage);
  providerPhase = "incomplete";
  await assert.rejects(readReceiptWithDoubleword(jpeg), OCRError, "truncated OCR must not be used");
  providerPhase = "completed";
  providerContent = "";
  await assert.rejects(readReceiptWithDoubleword(jpeg), OCRError);
  providerContent = markdown;
  for (const status of [401, 402, 413, 429, 500]) {
    providerStatus = status;
    await assert.rejects(readReceiptWithDoubleword(jpeg), OCRError);
  }
  providerStatus = 200;
  providerFailure = true;
  await assert.rejects(readReceiptWithDoubleword(jpeg), (error: unknown) => error instanceof OCRError && !/offline-test-key|private image/.test(error.message));
  providerFailure = false;
  delete process.env.OCR_API_KEY;
  console.log("Doubleword offline checks passed: table prices, quantities, weights, truncation and provider failures.");
  process.env.RPC_URL = await listen(rpcServer);
  process.env.NODE_ENV = "production";
  process.env.GOOGLE_CREDENTIALS_JSON = "{}";
  process.env.DATABASE_URL = "postgres://test@127.0.0.1/receipt-test";
  const { createReceiptHash } = await import("../server/services/receipt-hash.js");
  ImageAnnotatorClient.prototype.batchAnnotateImages = (async () => [{ responses: [{
    fullTextAnnotation: { text: [...currentLines, "DATE 09/10/2026"].join("\n"), pages: [{ confidence: 0.95 }] },
  }] }]) as never;
  const staging = new Map<string, { doublewordJob?: unknown; [key: string]: unknown }>();
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
      if (isClaim && staging.get(key)?.doublewordJob) return { rows: [] };
      const payload = structuredClone(params[2]) as { doublewordJob?: unknown };
      staging.set(key, payload);
      if (!isClaim) stagedWrites++;
      return { rows: isClaim ? [{ payload }] : [] };
    }
    return { rows: [] };
  }) as never;
  const { default: verifyReceipt } = await import("../server/routes/verify-receipt.js");
  // Config loads .env during import; live credentials must never enter the mock tests.
  delete process.env.OCR_API_KEY;
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
  process.env.OCR_API_KEY = "offline-test-key";
  const callsBeforeGood = providerCalls;
  await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  assert.equal(providerCalls, callsBeforeGood, "valid Vision output never calls Doubleword even with its key enabled");
  currentLines = partial;
  providerPhase = "completed";
  const repaired = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const directBody = await repaired.json() as { data: { receiptHash: string; totalSpent: number } };
  assert.equal(repaired.status, 200, "Qwen completes in the original verification request");
  assert.equal(directBody.data.totalSpent, 8);
  assert.equal(providerCalls, callsBeforeGood + 1);
  const duplicate = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  assert.equal(duplicate.status, 200);
  assert.equal(providerCalls, callsBeforeGood + 1, "duplicate uploads never create another paid job");
  // Simulate an already submitted DeepSeek background job from the previous version.
  const stagedJob = [...staging.values()].find((payload) => payload.doublewordJob)?.doublewordJob as {
    token: string; responseId: string | null; status: string; verificationResponse?: unknown;
  };
  assert(stagedJob);
  delete stagedJob.verificationResponse;
  stagedJob.responseId = "resp_test";
  stagedJob.status = "processing";
  providerPhase = "queued";
  const pendingBody = { pendingAnalysis: { receiptHash: directBody.data.receiptHash, token: stagedJob.token } };
  const pollingBody = { onlyAnalyze: true, userAddress: body.userAddress, pendingAnalysis: pendingBody.pendingAnalysis };
  const requestPoll = (payload = pollingBody) => fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  assert.equal((await requestPoll({ ...pollingBody, pendingAnalysis: { ...pendingBody.pendingAnalysis, token: "0".repeat(36) } })).status, 404);
  assert.equal((await requestPoll({ ...pollingBody, userAddress: `0x${"2".repeat(40)}` })).status, 404);
  assert.equal((await requestPoll()).status, 202);
  providerStatus = 500;
  assert.equal((await requestPoll()).status, 502);
  providerStatus = 200;
  assert.equal((await requestPoll()).status, 202, "a transient polling failure resumes the same job");
  assert.equal(providerCalls, callsBeforeGood + 1);
  providerPhase = "completed";
  const completed = await requestPoll({ ...pollingBody, ...{ householdSize: 9, daysCovered: 99 } });
  const repairedBody = await completed.json() as { data: { receiptHash: string; totalSpent: number; ocrConfidence: number; analysisMethod: string; householdSize: number; products: Array<{ quantity: number }> } };
  assert.equal(completed.status, 200);
  assert.equal(providerCalls, callsBeforeGood + 1);
  assert.equal(repairedBody.data.totalSpent, 8);
  assert.equal(repairedBody.data.products[0].quantity, 2);
  assert.equal(repairedBody.data.householdSize, 1);
  assert.equal(repairedBody.data.analysisMethod, "image-recovery");
  assert.equal(repairedBody.data.ocrConfidence, 0, "unknown provider confidence must not be invented");
  assert.equal(repairedBody.data.receiptHash, createReceiptHash([...partial, "DATE 09/10/2026"], "2026-10-09"), "recovery must preserve the original receipt identity");
  const pollsBeforeCache = pollCalls;
  assert.equal((await requestPoll()).status, 200);
  assert.equal(pollCalls, pollsBeforeCache, "ready jobs use the staged result");
  const writesBeforeBad = stagedWrites;
  staging.clear();
  providerContent = "APPLE $5.00\nBREAD\nTOTAL $8.00";
  const badRecovery = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  assert.equal(badRecovery.status, 422);
  assert.equal(stagedWrites, writesBeforeBad, "bad secondary results cannot reach the wallet");
  const callsAfterFailure = providerCalls;
  assert.equal((await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })).status, 502);
  assert.equal(providerCalls, callsAfterFailure, "failed jobs are not automatically resubmitted");
  staging.clear();
  providerContent = markdown;
  providerPhase = "incomplete";
  const truncatedRecovery = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  assert.equal(truncatedRecovery.status, 502);
  assert.equal(stagedWrites, writesBeforeBad);
  assert.equal(chainWrites, 0);
  staging.clear();
  providerPhase = "completed";
  const beforeConcurrent = providerCalls;
  const concurrent = await Promise.all([1, 2].map(() => fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })));
  assert(concurrent.every((response) => [200, 202].includes(response.status)));
  assert.equal(providerCalls, beforeConcurrent + 1, "concurrent uploads submit only one OCR job");
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

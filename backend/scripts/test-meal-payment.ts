/** Offline transfer validation, replay protection and retry tests. No real payments or model requests. */
import assert from "node:assert/strict";
import { ethers } from "ethers";
import { Pool } from "pg";
import { createServer } from "node:http";
import express from "express";

Object.assign(process.env, { NODE_ENV: "production", DATABASE_URL: "postgres://test@127.0.0.1/meal-payment-test", DATABASE_SSL: "",
  RPC_URL: "http://127.0.0.1:1", X402_PAY_TO: `0x${"2".repeat(40)}`, MEAL_PAYMENT_TO: "", OCR_API_KEY: "offline-test", CDP_API_KEY_ID: "", CDP_API_KEY_SECRET: "" });
const payer = `0x${"1".repeat(40)}`;
const recipient = process.env.X402_PAY_TO!;
const image = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a6x0AAAAASUVORK5CYII=";
const token = new ethers.Interface(["function transfer(address to,uint256 amount) returns(bool)", "event Transfer(address indexed from,address indexed to,uint256 value)"]);
const originalQuery = Pool.prototype.query;
const originalTransaction = ethers.JsonRpcProvider.prototype.getTransaction;
const originalReceipt = ethers.JsonRpcProvider.prototype.getTransactionReceipt;
const originalFetch = globalThis.fetch;
const rows = new Map<string, any>();
let transaction: { data: string } | null = null;
let receipt: { status: number; logs: Array<{ address: string; topics: readonly string[]; data: string }> } | null = null;
let reads = 0;
Pool.prototype.query = (async (sql: string, values: any[] = []) => {
  if (sql.includes("LIMIT 0")) return { rows: [] };
  if (sql.startsWith("SELECT payer_wallet")) return { rows: rows.has(values[0]) ? [rows.get(values[0])] : [] };
  if (sql.includes("INSERT INTO x402_payments")) {
    if (!rows.has(values[4])) rows.set(values[4], { payer_wallet: values[0], resource_id: values[5], source_snapshot: values[6] });
    return { rows: [] };
  }
  const row = rows.get(values[0]);
  assert(row);
  if (sql.includes("jsonb_build_object")) {
    if (!["pending", "failed"].includes(row.source_snapshot.state)) return { rows: [] };
    row.source_snapshot = { state: "processing", claim: values[1] };
    return { rows: [{ id: "1" }] };
  }
  if (sql.includes("SET source_snapshot = $3")) {
    if (row.source_snapshot.claim !== values[1]) return { rows: [] };
    row.source_snapshot = values[2];
    return { rows: [{ id: "1" }] };
  }
  if (sql.includes('"state":"failed"')) {
    if (row.source_snapshot.claim === values[1]) row.source_snapshot = { state: "failed" };
    return { rows: [] };
  }
  throw Error(`Unexpected SQL: ${sql}`);
}) as never;
ethers.JsonRpcProvider.prototype.getTransaction = (async () => { reads++; return transaction; }) as never;
ethers.JsonRpcProvider.prototype.getTransactionReceipt = (async () => receipt) as never;
globalThis.fetch = ((input, init) => {
  assert.match(String(input), /^http:\/\/127\.0\.0\.1:/, "Offline tests cannot contact external services");
  return originalFetch(input, { ...init, signal: AbortSignal.timeout(10000) });
}) as typeof fetch;
let server: ReturnType<typeof createServer> | undefined;
try {
  const { assertMealTransfer, mealImageHash, mealPaymentInfo, runPaidMealAnalysis } = await import("../server/services/meal-payment.js");
  const { default: mealRouter } = await import("../server/routes/meal.js");
  const imageHash = mealImageHash(image);
  const info = mealPaymentInfo();
  const log = (from = payer, to = recipient, amount = 10000n, asset = info.asset) => ({ address: asset, ...token.encodeEventLog(token.getEvent("Transfer")!, [from, to, amount]) });
  const call = token.encodeFunctionData("transfer", [recipient, 10000n]) + imageHash.slice(2);
  transaction = { data: call };
  receipt = { status: 1, logs: [log()] };
  assertMealTransfer(transaction, receipt, payer, imageHash);
  assertMealTransfer({ data: `0xdeadbeef${call.slice(2)}0000` }, receipt, payer, imageHash);
  for (const bad of [log(payer, recipient, 9999n), log(payer, payer), log(recipient), log(payer, recipient, 10000n, payer)]) {
    assert.throws(() => assertMealTransfer(transaction!, { status: 1, logs: [bad] }, payer, imageHash));
  }
  assert.throws(() => assertMealTransfer(transaction!, { status: 0, logs: [log()] }, payer, imageHash), /reverted/);
  assert.throws(() => assertMealTransfer({ data: token.encodeFunctionData("transfer", [recipient, 10000n]) }, receipt!, payer, imageHash), /bound/);
  assert.throws(() => assertMealTransfer(transaction!, receipt!, recipient, imageHash), /different/);
  let analyses = 0;
  const data = { balanceScore: 85 } as Awaited<ReturnType<typeof runPaidMealAnalysis>> & object;
  const analyze = async () => { analyses++; return data as never; };
  const input = { txHash: `0x${"a".repeat(64)}`, payerAddress: payer, imageBase64: image };
  receipt = null;
  await assert.rejects(runPaidMealAnalysis(input, analyze), /confirmation/);
  assert.equal(analyses, 0);
  receipt = { status: 1, logs: [log()] };
  assert.deepEqual(await runPaidMealAnalysis(input, analyze), data);
  const verifiedReads = reads;
  assert.deepEqual(await runPaidMealAnalysis(input, analyze), data);
  assert.equal(analyses, 1, "Duplicate requests reuse the result");
  assert.equal(reads, verifiedReads, "A saved, verified transfer needs no extra chain lookup");
  await assert.rejects(runPaidMealAnalysis({ ...input, payerAddress: recipient }, analyze), /another wallet/);
  const differentImage = Buffer.concat([Buffer.from(image, "base64"), Buffer.from([0])]).toString("base64");
  await assert.rejects(runPaidMealAnalysis({ ...input, imageBase64: differentImage }, analyze), /another wallet or photo/);
  const retryInput = { ...input, txHash: `0x${"b".repeat(64)}` };
  await assert.rejects(runPaidMealAnalysis(retryInput, async () => { throw Error("model unavailable"); }), /model unavailable/);
  assert.deepEqual(await runPaidMealAnalysis(retryInput, analyze), data, "A model failure can resume with the original payment");
  let finish!: (value: never) => void;
  let started!: () => void;
  const ready = new Promise<void>((resolve) => { started = resolve; });
  const concurrentInput = { ...input, txHash: `0x${"c".repeat(64)}` };
  const first = runPaidMealAnalysis(concurrentInput, () => { started(); return new Promise((resolve) => { finish = resolve; }); });
  await ready;
  assert.equal(await runPaidMealAnalysis(concurrentInput, analyze), null, "An in-flight payment cannot start a second model call");
  finish(data as never);
  await first;
  const app = express();
  app.use(express.json());
  app.use("/api/analyze-meal", mealRouter);
  server = createServer(app);
  await new Promise<void>((resolve) => server!.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert(address && typeof address !== "string");
  const url = `http://127.0.0.1:${address.port}/api/analyze-meal`;
  const quote = await (await fetch(url + "/payment")).json();
  assert.equal(quote.payment.amount, "10000");
  const unpaid = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", "PAYMENT-SIGNATURE": "not-a-transfer" }, body: JSON.stringify({ imageBase64: image }) });
  assert.equal(unpaid.status, 400);
  assert.equal(unpaid.headers.get("payment-required"), null);
  const cached = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
  assert.equal(cached.status, 200);
  assert.equal((await cached.json()).data.balanceScore, 85);
  assert.equal(cached.headers.get("cache-control"), "private, no-store");
  console.log("Meal direct payments: exact transfer, photo binding, smart-wallet calldata, replay, retry, concurrent claims and HTTP flow OK");
} finally {
  Pool.prototype.query = originalQuery;
  ethers.JsonRpcProvider.prototype.getTransaction = originalTransaction;
  ethers.JsonRpcProvider.prototype.getTransactionReceipt = originalReceipt;
  globalThis.fetch = originalFetch;
  server?.closeAllConnections();
  if (server) await new Promise<void>((resolve) => server!.close(() => resolve()));
}

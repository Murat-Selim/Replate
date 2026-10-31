import { createHash, randomUUID } from "node:crypto";
import { ethers } from "ethers";
import { INTELLIGENCE_PRICING, runtimeConfig } from "../config.js";
import { getDatabasePool } from "../db.js";
import { validateDoublewordImage } from "./receipt-reader.js";
import type { MealAnalysisResult } from "./meal-analysis.js";

const token = new ethers.Interface([
  "function transfer(address to, uint256 amount) returns (bool)",
  "event Transfer(address indexed from, address indexed to, uint256 value)",
]);

export class MealPaymentError extends Error {
  constructor(message: string, public readonly status: number, public readonly code: string) { super(message); }
}

export function mealPaymentInfo() {
  const payTo = (process.env.MEAL_PAYMENT_TO || runtimeConfig.x402PayTo).trim();
  if (!ethers.isAddress(payTo) || payTo === ethers.ZeroAddress) {
    throw new MealPaymentError("Meal analysis payments are unavailable", 503, "PAYMENTS_UNAVAILABLE");
  }
  return { chainId: 8453, asset: runtimeConfig.x402Asset, payTo: ethers.getAddress(payTo),
    amount: INTELLIGENCE_PRICING.mealAnalysis.atomic, price: INTELLIGENCE_PRICING.mealAnalysis.usd };
}

export function mealImageHash(image: string): string {
  const { base64 } = validateDoublewordImage(image);
  return `0x${createHash("sha256").update(Buffer.from(base64, "base64")).digest("hex")}`;
}

export function assertMealTransfer(
  transaction: { data: string },
  receipt: { status: number | null; logs: ReadonlyArray<{ address: string; topics: readonly string[]; data: string }> },
  payer: string,
  imageHash: string,
): boolean {
  const payment = mealPaymentInfo();
  if (receipt.status !== 1) throw new MealPaymentError("Payment transaction reverted. You can try a new payment.", 422, "PAYMENT_REVERTED");
  if (payer.toLowerCase() === payment.payTo.toLowerCase()) throw new MealPaymentError("Use a wallet different from the payment recipient", 400, "SELF_PAYMENT");
  // The transfer calldata commits to this photo, so a public tx hash cannot pay for a different image.
  const call = token.encodeFunctionData("transfer", [payment.payTo, payment.amount]).slice(2) + imageHash.slice(2);
  if (!transaction.data.toLowerCase().includes(call.toLowerCase())) {
    throw new MealPaymentError("This payment is not bound to the selected photo", 403, "PAYMENT_IMAGE_MISMATCH");
  }
  const paid = receipt.logs.some((log) => {
    if (log.address.toLowerCase() !== payment.asset.toLowerCase()) return false;
    try {
      const event = token.parseLog({ topics: [...log.topics], data: log.data });
      return event?.name === "Transfer" && event.args.from.toLowerCase() === payer.toLowerCase()
        && event.args.to.toLowerCase() === payment.payTo.toLowerCase() && event.args.value === BigInt(payment.amount);
    } catch { return false; }
  });
  if (!paid) throw new MealPaymentError("A confirmed 0.01 USDC transfer from your wallet is required", 403, "INVALID_PAYMENT");
  return transaction.data.toLowerCase().includes(runtimeConfig.builderCodeSuffix.toLowerCase());
}

export async function runPaidMealAnalysis(
  input: { txHash: string; payerAddress: string; imageBase64: string },
  analyze: () => Promise<MealAnalysisResult>,
): Promise<MealAnalysisResult | null> {
  if (!/^0x[a-fA-F0-9]{64}$/.test(input.txHash) || !ethers.isAddress(input.payerAddress)) {
    throw new MealPaymentError("A payment transaction hash and payer address are required", 400, "INVALID_PAYMENT_REQUEST");
  }
  const imageHash = mealImageHash(input.imageBase64);
  const payer = input.payerAddress.toLowerCase();
  const txHash = input.txHash.toLowerCase();
  const identifier = `base-transfer:${txHash}`;
  const pool = getDatabasePool();
  const read = async () => (await pool.query(
    "SELECT payer_wallet, resource_id, source_snapshot FROM x402_payments WHERE payment_identifier = $1", [identifier],
  )).rows[0];
  let saved = await read();
  if (!saved) {
    let builderCodeAttributed = false;
    const request = new ethers.FetchRequest(runtimeConfig.rpcUrl || "https://base-rpc.publicnode.com");
    request.timeout = 15000;
    const provider = new ethers.JsonRpcProvider(request, 8453, { staticNetwork: true });
    try {
      const [transaction, receipt] = await Promise.all([provider.getTransaction(txHash), provider.getTransactionReceipt(txHash)]);
      if (!transaction || !receipt) throw new MealPaymentError("Waiting for payment confirmation", 409, "PAYMENT_PENDING");
      builderCodeAttributed = assertMealTransfer(transaction, receipt, payer, imageHash);
    } finally { provider.destroy(); }
    const payment = mealPaymentInfo();
    // Reuse the existing payment ledger with a separate identifier namespace; no x402 authorization is used.
    await pool.query(
      `INSERT INTO x402_payments
       (user_wallet, payer_wallet, payer_address, amount, asset, network, payment_status, transaction_hash,
        payment_identifier, resource_type, resource_id, endpoint, source_snapshot, settled_at, builder_code_attributed)
       VALUES ($1,$1,$1,$2,$3,'eip155:8453','settled',$4,$5,'meal_analysis',$6,'POST /api/analyze-meal',$7,NOW(),$8)
       ON CONFLICT (payment_identifier) DO NOTHING`,
      [payer, payment.amount, payment.asset, txHash, identifier, imageHash, { state: "pending" }, builderCodeAttributed],
    );
    saved = await read();
  }
  if (!saved || saved.payer_wallet.toLowerCase() !== payer || saved.resource_id !== imageHash) {
    throw new MealPaymentError("This payment belongs to another wallet or photo", 403, "PAYMENT_ALREADY_USED");
  }
  if (saved.source_snapshot?.state === "completed") return saved.source_snapshot.data as MealAnalysisResult;
  const claim = randomUUID();
  const claimed = await pool.query(
    `UPDATE x402_payments SET source_snapshot = jsonb_build_object('state','processing','claim',$2::text,'startedAt',NOW())
     WHERE payment_identifier = $1 AND payment_status = 'settled'
       AND (source_snapshot->>'state' IN ('pending','failed')
         OR (source_snapshot->>'state' = 'processing' AND (source_snapshot->>'startedAt')::timestamptz < NOW() - INTERVAL '90 seconds'))
     RETURNING id`, [identifier, claim],
  );
  if (!claimed.rows.length) return null;
  try {
    const data = await analyze();
    const completed = await pool.query(
      `UPDATE x402_payments SET source_snapshot = $3::jsonb
       WHERE payment_identifier = $1 AND source_snapshot->>'claim' = $2 RETURNING id`,
      [identifier, claim, { state: "completed", data }],
    );
    return completed.rows.length ? data : null;
  } catch (error) {
    await pool.query(
      `UPDATE x402_payments SET source_snapshot = '{"state":"failed"}'::jsonb
       WHERE payment_identifier = $1 AND source_snapshot->>'claim' = $2`, [identifier, claim],
    ).catch(() => undefined);
    throw error;
  }
}

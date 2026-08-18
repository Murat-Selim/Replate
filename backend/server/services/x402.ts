import { createHash } from "crypto";
import { ethers } from "ethers";
import { RequestHandler } from "express";
import { paymentMiddleware, x402ResourceServer } from "@x402/express";
import { HTTPFacilitatorClient } from "@x402/core/server";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import {
  bazaarResourceServerExtension,
  declareBuilderCodeExtension,
  declareDiscoveryExtension,
} from "@x402/extensions";
import {
  createCdpFacilitatorClient,
  getCdpExtensionRegistrations,
} from "@coinbase/cdp-sdk/x402";
import type { SettleResultContext, SettleContext } from "@x402/core/types";
import { runtimeConfig } from "../config.js";
import { getDatabasePool } from "../db.js";
import { buildIntelligenceReport, IntelligenceFeatureSet } from "./intelligence-rules.js";

export const X402_ROUTE = "POST /api/intelligence/advanced";
export const x402Configured = Boolean(
  runtimeConfig.x402PayTo &&
  ((runtimeConfig.cdpApiKeyId && runtimeConfig.cdpApiKeySecret) || runtimeConfig.x402FacilitatorUrl),
);

interface PaymentRequestBody {
  receiptId?: string | number;
  receiptHash?: string;
  userAddress?: string;
}

function requestBody(context: SettleContext): PaymentRequestBody {
  const adapter = (context.transportContext as { request?: { adapter?: { getBody?: () => unknown } } } | undefined)?.request?.adapter;
  return (adapter?.getBody?.() || {}) as PaymentRequestBody;
}

export function paymentIdentifier(payload: unknown): string {
  return `x402:${createHash("sha256").update(JSON.stringify(payload)).digest("hex")}`;
}

export function payerAddress(payload: unknown): string {
  const inner = ((payload as { payload?: unknown }).payload || {}) as Record<string, unknown>;
  const authorization = (inner.authorization || inner.permit2Authorization) as { from?: string } | undefined;
  return authorization?.from || "";
}

async function receiptForPayment(client: any, context: SettleContext) {
  const body = requestBody(context);
  const receiptId = String(body.receiptId || "");
  const payer = payerAddress(context.paymentPayload);
  if (!/^\d+$/.test(receiptId) || !/^0x[a-fA-F0-9]{40}$/.test(payer) || !/^0x[a-fA-F0-9]{40}$/.test(body.userAddress || "") ||
    body.userAddress!.toLowerCase() !== payer.toLowerCase()) return null;
  const result = await client.query(
    `SELECT r.id, r.receipt_hash, u.wallet_address
     FROM receipts r JOIN users u ON u.id = r.user_id
     WHERE r.id = $1 AND lower(u.wallet_address) = lower($2) AND r.receipt_hash = $3`,
    [receiptId, payer, body.receiptHash],
  );
  return result.rows[0] || null;
}

async function settlementBuilderCodeAttribution(transactionHash: string): Promise<boolean | null> {
  try {
    const provider = new ethers.JsonRpcProvider(runtimeConfig.rpcUrl || "https://base-rpc.publicnode.com");
    const transaction = await provider.getTransaction(transactionHash);
    if (!transaction?.data) return null;
    return transaction.data.toLowerCase().endsWith(runtimeConfig.builderCodeSuffix.toLowerCase());
  } catch {
    return null;
  }
}

async function saveSubmittedPayment(context: SettleContext): Promise<void> {
  const client = await getDatabasePool().connect();
  try {
    const receipt = await receiptForPayment(client, context);
    if (!receipt) return Promise.reject(new Error("Receipt ownership or identity check failed"));
    const body = requestBody(context);
    const identifier = paymentIdentifier(context.paymentPayload);
    await client.query("BEGIN");
    const existing = await client.query("SELECT id, receipt_id, payment_status FROM x402_payments WHERE payment_identifier = $1 FOR UPDATE", [identifier]);
    if (existing.rows[0]) {
      if (String(existing.rows[0].receipt_id) !== String(receipt.id)) throw new Error("Payment was already used for another receipt");
      if (existing.rows[0].payment_status === "settled") throw new Error("Payment was already settled");
      await client.query("ROLLBACK");
      return;
    }
    await client.query(
      `INSERT INTO x402_payments
       (receipt_id, receipt_hash, user_wallet, payer_wallet, amount, asset, network, payment_status, payment_identifier)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'submitted',$8)`,
      [receipt.id, receipt.receipt_hash, body.userAddress, payerAddress(context.paymentPayload), context.requirements.amount,
        context.requirements.asset, context.requirements.network, identifier],
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

async function settlePaymentAndBuildReport(context: SettleResultContext): Promise<void> {
  if (!context.result.success || !context.result.transaction) return;
  const client = await getDatabasePool().connect();
  try {
    const identifier = paymentIdentifier(context.paymentPayload);
    const builderCodeAttributed = await settlementBuilderCodeAttribution(context.result.transaction);
    await client.query("BEGIN");
    const payment = await client.query(
      `UPDATE x402_payments SET payment_status = 'settled', transaction_hash = $1, settled_at = NOW(), builder_code_attributed = $2
       WHERE payment_identifier = $3 RETURNING id, receipt_id, user_wallet`,
      [context.result.transaction, builderCodeAttributed, identifier],
    );
    if (!payment.rows[0]) throw new Error("Submitted payment record was not found");
    const features = await client.query<{ feature_name: string; feature_value: string }>(
      "SELECT feature_name, feature_value FROM derived_features WHERE receipt_id = $1 AND calculation_version = 'features-v1'",
      [payment.rows[0].receipt_id],
    );
    const featureSet = Object.fromEntries(features.rows.map((row) => [row.feature_name, Number(row.feature_value)])) as unknown as IntelligenceFeatureSet;
    const report = buildIntelligenceReport(featureSet);
    await client.query(
      `INSERT INTO intelligence_reports
       (receipt_id, payment_id, user_wallet, report_type, report_status, report_payload, rule_version, insight_confidence, completed_at)
       VALUES ($1,$2,$3,'advanced','completed',$4,$5,$6,NOW())
       ON CONFLICT (payment_id) DO UPDATE SET report_status = EXCLUDED.report_status,
         report_payload = EXCLUDED.report_payload, rule_version = EXCLUDED.rule_version,
         insight_confidence = EXCLUDED.insight_confidence, completed_at = EXCLUDED.completed_at`,
      [payment.rows[0].receipt_id, payment.rows[0].id, payment.rows[0].user_wallet, report, report.ruleVersion, report.insightConfidence],
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    console.error("x402 settlement persisted but report generation failed:", error);
  } finally {
    client.release();
  }
}

export function createX402Middleware(): RequestHandler | null {
  if (!x402Configured) return null;
  const facilitator = runtimeConfig.cdpApiKeyId && runtimeConfig.cdpApiKeySecret
    ? createCdpFacilitatorClient({
      apiKeyId: runtimeConfig.cdpApiKeyId,
      apiKeySecret: runtimeConfig.cdpApiKeySecret,
      baseUrl: runtimeConfig.x402FacilitatorUrl || undefined,
    })
    : new HTTPFacilitatorClient({
      url: runtimeConfig.x402FacilitatorUrl,
      createAuthHeaders: runtimeConfig.x402FacilitatorApiKey
        ? async () => {
          const headers = { Authorization: `Bearer ${runtimeConfig.x402FacilitatorApiKey}` };
          return { verify: headers, settle: headers, supported: headers };
        }
        : undefined,
    });
  const resourceServer = new x402ResourceServer(facilitator);
  resourceServer.registerExtension(bazaarResourceServerExtension);
  for (const extension of getCdpExtensionRegistrations()) resourceServer.registerExtension(extension);
  resourceServer
    .register(runtimeConfig.x402Network, new ExactEvmScheme())
    .onBeforeSettle(async (context) => {
      try {
        await saveSubmittedPayment(context);
      } catch (error) {
        return { abort: true, reason: error instanceof Error ? error.message : "payment_record_failed" };
      }
    })
    .onAfterSettle(settlePaymentAndBuildReport);
  return paymentMiddleware({
    [X402_ROUTE]: {
      accepts: {
        scheme: "exact",
        network: runtimeConfig.x402Network,
        payTo: runtimeConfig.x402PayTo,
        price: {
          amount: runtimeConfig.x402PriceAtomic,
          asset: runtimeConfig.x402Asset,
          extra: { name: "USD Coin", version: "2" },
        },
        maxTimeoutSeconds: 300,
      },
      extensions: {
        "builder-code": declareBuilderCodeExtension(runtimeConfig.builderCode, ["cdp_sdk_server"]),
        ...declareDiscoveryExtension({
          bodyType: "json",
          input: {
            receiptId: 1,
            receiptHash: "0x0000000000000000000000000000000000000000000000000000000000000000",
            userAddress: "0x0000000000000000000000000000000000000000",
          },
          inputSchema: {
            type: "object",
            properties: {
              receiptId: { type: ["string", "number"] },
              receiptHash: { type: "string", pattern: "^0x[a-fA-F0-9]{64}$" },
              userAddress: { type: "string", pattern: "^0x[a-fA-F0-9]{40}$" },
            },
            required: ["receiptId", "receiptHash", "userAddress"],
            additionalProperties: false,
          },
          output: {
            example: { success: true, receiptId: "1", report: {} },
          },
        }),
      },
      description: "Advanced Replate Intelligence report",
      mimeType: "application/json",
    },
  }, resourceServer);
}

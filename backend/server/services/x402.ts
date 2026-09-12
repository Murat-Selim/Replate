import { createHash } from "crypto";
import { ethers } from "ethers";
import { RequestHandler } from "express";
import { paymentMiddleware, x402ResourceServer } from "@x402/express";
import { HTTPFacilitatorClient } from "@x402/core/server";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { bazaarResourceServerExtension, declareBuilderCodeExtension, declareDiscoveryExtension } from "@x402/extensions";
import { createCdpFacilitatorClient, getCdpExtensionRegistrations } from "@coinbase/cdp-sdk/x402";
import type { SettleContext, SettleFailureContext, SettleResultContext } from "@x402/core/types";
import { INTELLIGENCE_PRICING, runtimeConfig } from "../config.js";
import { getDatabasePool } from "../db.js";
import { buildAdvancedFromFeatures, buildBundle, buildRecommendations, findReceipt, receiptFeatures, type BundleIntelligence, type Recommendation } from "./intelligence-data.js";
import { buildCategorySignal, buildProductSignal, MIN_SIGNAL_SAMPLE_SIZE, saveCategorySignal, saveProductSignal } from "./signal-engine.js";

export const X402_ROUTE = "POST /api/intelligence/advanced";
export const x402Configured = Boolean(
  runtimeConfig.x402PayTo && ((runtimeConfig.cdpApiKeyId && runtimeConfig.cdpApiKeySecret) || runtimeConfig.x402FacilitatorUrl),
);

export type PaidResourceType =
  | "advanced_receipt" | "basket_intelligence" | "receipt_price" | "product_price"
  | "behavior_intelligence" | "recommendation" | "intelligence_bundle"
  | "product_signal" | "category_signal" | "merchant_signal";

interface PaymentRequestBody {
  receiptId?: string | number;
  receiptHash?: string;
  userAddress?: string;
  include?: string[];
}

interface PaidResourceRequest {
  resourceType: PaidResourceType;
  resourceId: string;
  endpoint: string;
  receiptId?: string;
  receiptHash?: string;
  userAddress?: string;
  include?: string[];
}

interface PaymentTransportContext {
  request?: {
    path?: string;
    method?: string;
    adapter?: { getPath?: () => string; getMethod?: () => string; getBody?: () => unknown };
  };
}

export function paymentIdentifier(payload: unknown): string {
  return `x402:${createHash("sha256").update(JSON.stringify(payload)).digest("hex")}`;
}

export function parsePaymentPayloadHeader(header: string): unknown | null {
  try { return JSON.parse(Buffer.from(header, "base64").toString("utf8")); } catch { return null; }
}

export function payerAddress(payload: unknown): string {
  const inner = ((payload as { payload?: unknown }).payload || {}) as Record<string, unknown>;
  const authorization = (inner.authorization || inner.permit2Authorization) as { from?: string } | undefined;
  return authorization?.from || "";
}

export function payerAddressFromHeader(header: string): string {
  return payerAddress(parsePaymentPayloadHeader(header) || {});
}

function requestResource(context: SettleContext): PaidResourceRequest | null {
  const transport = context.transportContext as PaymentTransportContext | undefined;
  const request = transport?.request;
  const path = request?.path || request?.adapter?.getPath?.() || "";
  const method = request?.method || request?.adapter?.getMethod?.() || "";
  const body = (request?.adapter?.getBody?.() || {}) as PaymentRequestBody;
  const endpoint = `${method} ${path}`;

  if (method === "POST" && path === "/api/intelligence/advanced") {
    return { resourceType: "advanced_receipt", resourceId: String(body.receiptId || ""), endpoint, receiptId: String(body.receiptId || ""), receiptHash: body.receiptHash, userAddress: body.userAddress };
  }
  if (method === "POST" && path === "/api/intelligence/bundle") {
    return { resourceType: "intelligence_bundle", resourceId: String(body.receiptId || ""), endpoint, receiptId: String(body.receiptId || ""), include: body.include };
  }

  const dynamicRoutes: Array<[RegExp, PaidResourceType]> = [
    [/^\/api\/intelligence\/basket\/(\d+)$/, "basket_intelligence"],
    [/^\/api\/intelligence\/price\/receipt\/(\d+)$/, "receipt_price"],
    [/^\/api\/intelligence\/price\/product\/(\d+)$/, "product_price"],
    [/^\/api\/intelligence\/recommendation\/(\d+)$/, "recommendation"],
  ];
  for (const [pattern, resourceType] of dynamicRoutes) {
    const match = path.match(pattern);
    if (method === "GET" && match) return { resourceType, resourceId: decodeURIComponent(match[1]), endpoint };
  }
  if (method === "GET" && path === "/api/intelligence/behavior/me") return { resourceType: "behavior_intelligence", resourceId: "me", endpoint };
  return null;
}

function isReceiptResource(resourceType: PaidResourceType): boolean {
  return ["advanced_receipt", "basket_intelligence", "receipt_price", "recommendation", "intelligence_bundle"].includes(resourceType);
}

async function validateResource(client: any, resource: PaidResourceRequest, payer: string) {
  if (resource.resourceType === "merchant_signal") throw new Error("Merchant signals are not available until merchant normalization is populated");

  if (isReceiptResource(resource.resourceType)) {
    if (!/^\d+$/.test(resource.receiptId || "")) throw new Error("A verified receipt ID is required");
    if (resource.resourceType === "advanced_receipt" && resource.userAddress?.toLowerCase() !== payer.toLowerCase()) throw new Error("Payment payer must match userAddress");
    const receipt = await findReceipt(client, resource.receiptId!, payer, resource.receiptHash);
    if (!receipt) throw new Error("Receipt ownership or identity check failed");
    if (resource.resourceType === "advanced_receipt") {
      const features = await client.query("SELECT COUNT(*) AS count FROM derived_features WHERE receipt_id = $1 AND calculation_version = 'features-v1'", [receipt.id]);
      if (Number(features.rows[0]?.count || 0) < 11) throw new Error("Receipt intelligence features are not ready");
    }
    return { receiptId: receipt.id, receiptHash: receipt.receiptHash, userWallet: receipt.walletAddress };
  }

  if (resource.resourceType === "behavior_intelligence") {
    const user = await client.query("SELECT wallet_address FROM users WHERE lower(wallet_address) = lower($1)", [payer]);
    if (!user.rows[0]) throw new Error("Behavior wallet is not registered");
    return { userWallet: user.rows[0].wallet_address };
  }

  if (resource.resourceType === "product_price" || resource.resourceType === "product_signal") {
    const product = await client.query("SELECT id FROM canonical_products WHERE id = $1", [resource.resourceId]);
    if (!product.rows[0]) throw new Error("Canonical product not found");
    const observations = await client.query("SELECT COUNT(*) AS count FROM receipt_items WHERE canonical_product_id = $1 AND paid_price IS NOT NULL", [resource.resourceId]);
    const count = Number(observations.rows[0].count);
    if (!count) throw new Error("Product price observations are not ready");
    if (resource.resourceType === "product_signal" && count < MIN_SIGNAL_SAMPLE_SIZE) throw new Error(`Signal requires at least ${MIN_SIGNAL_SAMPLE_SIZE} observations`);
    return { userWallet: payer };
  }

  if (resource.resourceType === "category_signal") {
    const observations = await client.query(
      `SELECT COUNT(*) AS count FROM receipt_items ri JOIN canonical_products cp ON cp.id = ri.canonical_product_id
       WHERE lower(cp.category) = lower($1) AND ri.paid_price IS NOT NULL`,
      [resource.resourceId],
    );
    const count = Number(observations.rows[0].count);
    if (count < MIN_SIGNAL_SAMPLE_SIZE) throw new Error(`Signal requires at least ${MIN_SIGNAL_SAMPLE_SIZE} observations`);
    return { userWallet: payer };
  }
}

async function saveSubmittedPayment(context: SettleContext): Promise<void> {
  const resource = requestResource(context);
  const payer = payerAddress(context.paymentPayload);
  if (!resource || !/^0x[a-fA-F0-9]{40}$/.test(payer)) throw new Error("Payment resource or payer is invalid");
  const client = await getDatabasePool().connect();
  try {
    const validated = await validateResource(client, resource, payer);
    const identifier = paymentIdentifier(context.paymentPayload);
    await client.query("BEGIN");
    const existing = await client.query("SELECT id, resource_id, payment_status FROM x402_payments WHERE payment_identifier = $1 FOR UPDATE", [identifier]);
    if (existing.rows[0]) {
      if (String(existing.rows[0].resource_id) !== resource.resourceId) throw new Error("Payment was already used for another resource");
      if (existing.rows[0].payment_status === "settled") throw new Error("Payment was already settled");
      await client.query("ROLLBACK");
      return;
    }
    await client.query(
      `INSERT INTO x402_payments
       (receipt_id, receipt_hash, user_wallet, payer_wallet, payer_address, amount, asset, network,
        payment_status, payment_identifier, resource_type, resource_id, endpoint)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'submitted',$9,$10,$11,$12)`,
      [validated?.receiptId || null, validated?.receiptHash || null, validated?.userWallet || payer, payer, payer,
        context.requirements.amount, context.requirements.asset, context.requirements.network, identifier,
        resource.resourceType, resource.resourceId, resource.endpoint],
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally { client.release(); }
}

async function settlementBuilderCodeAttribution(transactionHash: string): Promise<boolean | null> {
  try {
    const provider = new ethers.JsonRpcProvider(runtimeConfig.rpcUrl || "https://base-rpc.publicnode.com");
    const transaction = await provider.getTransaction(transactionHash);
    return transaction?.data ? transaction.data.toLowerCase().includes(runtimeConfig.builderCodeSuffix.toLowerCase()) : null;
  } catch { return null; }
}

async function buildStoredReport(client: any, resourceType: PaidResourceType, receiptId: string, userWallet: string): Promise<ReturnType<typeof buildAdvancedFromFeatures> | BundleIntelligence | { receiptId: string; recommendations: Recommendation[] | null } | null> {
  if (resourceType === "advanced_receipt") return buildAdvancedFromFeatures(await receiptFeatures(client, receiptId));
  if (resourceType === "recommendation") return { receiptId, recommendations: await buildRecommendations(client, receiptId, userWallet) };
  if (resourceType === "intelligence_bundle") return buildBundle(client, receiptId, userWallet, []);
  return null;
}

async function settlePaymentAndBuildReport(context: SettleResultContext): Promise<void> {
  if (!context.result.success || !context.result.transaction) return;
  const resource = requestResource(context);
  if (!resource) return;
  const client = await getDatabasePool().connect();
  try {
    const identifier = paymentIdentifier(context.paymentPayload);
    const builderCodeAttributed = await settlementBuilderCodeAttribution(context.result.transaction);
    await client.query("BEGIN");
    const payment = await client.query(
      `UPDATE x402_payments
       SET payment_status = 'settled', transaction_hash = $1, settled_at = NOW(), builder_code_attributed = $2
       WHERE payment_identifier = $3
       RETURNING id, receipt_id, resource_type, resource_id, user_wallet`,
      [context.result.transaction, builderCodeAttributed, identifier],
    );
    if (!payment.rows[0]) throw new Error("Submitted payment record was not found");
    const row = payment.rows[0];

    if (row.receipt_id && ["advanced_receipt", "recommendation", "intelligence_bundle"].includes(row.resource_type)) {
      const report = await buildStoredReport(client, row.resource_type, String(row.receipt_id), row.user_wallet);
      if (report) {
        const reportObject = report;
        const ruleVersion = "ruleVersion" in reportObject ? reportObject.ruleVersion : "intelligence-v1";
        const insightConfidence = "insightConfidence" in reportObject ? reportObject.insightConfidence : null;
        await client.query(
          `INSERT INTO intelligence_reports
           (receipt_id, payment_id, user_wallet, report_type, report_status, report_payload, rule_version, insight_confidence, completed_at)
           VALUES ($1,$2,$3,$4,'completed',$5,$6,$7,NOW())
           ON CONFLICT (payment_id) DO UPDATE SET report_status = EXCLUDED.report_status,
             report_payload = EXCLUDED.report_payload, rule_version = EXCLUDED.rule_version,
             insight_confidence = EXCLUDED.insight_confidence, completed_at = EXCLUDED.completed_at`,
          [row.receipt_id, row.id, row.user_wallet, row.resource_type, reportObject, ruleVersion, insightConfidence],
        );
      }
    }

    if (["product_signal", "category_signal", "merchant_signal"].includes(row.resource_type)) {
      let signalId: string | null = null;
      if (row.resource_type === "product_signal") {
        const signal = await buildProductSignal(client, row.resource_id);
        if (signal) signalId = await saveProductSignal(client, signal);
      } else if (row.resource_type === "category_signal") {
        const signal = await buildCategorySignal(client, row.resource_id);
        if (signal) signalId = await saveCategorySignal(client, signal);
      }
      await client.query(
        `INSERT INTO signal_access_logs (signal_id, x402_payment_id, agent_address, resource_type, resource_id)
         VALUES ($1,$2,$3,$4,$5)`,
        [signalId, row.id, payerAddress(context.paymentPayload), row.resource_type, row.resource_id],
      );
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    console.error("x402 settlement persisted but post-payment persistence failed:", error);
  } finally { client.release(); }
}

async function markPaymentFailed(context: SettleFailureContext): Promise<void> {
  try {
    await getDatabasePool().query("UPDATE x402_payments SET payment_status = 'failed' WHERE payment_identifier = $1", [paymentIdentifier(context.paymentPayload)]);
  } catch (error) { console.error("x402 payment failure could not be persisted:", error); }
}

function routeConfig(price: { atomic: string; usd: string }, description: string) {
  return {
    accepts: {
      scheme: "exact", network: runtimeConfig.x402Network, payTo: runtimeConfig.x402PayTo,
      price: { amount: price.atomic, asset: runtimeConfig.x402Asset, extra: { name: "USD Coin", version: "2" } },
      maxTimeoutSeconds: 300,
    },
    description: `${description} (${price.usd} USDC)`,
    mimeType: "application/json",
    extensions: { "builder-code": declareBuilderCodeExtension(runtimeConfig.builderCode, ["cdp_sdk_server"]) },
  };
}

export function createX402Middleware(): RequestHandler | null {
  if (!x402Configured) return null;
  const facilitator = runtimeConfig.cdpApiKeyId && runtimeConfig.cdpApiKeySecret
    ? createCdpFacilitatorClient({ apiKeyId: runtimeConfig.cdpApiKeyId, apiKeySecret: runtimeConfig.cdpApiKeySecret, baseUrl: runtimeConfig.x402FacilitatorUrl || undefined })
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
  resourceServer.register(runtimeConfig.x402Network, new ExactEvmScheme())
    .onBeforeSettle(saveSubmittedPayment)
    .onAfterSettle(settlePaymentAndBuildReport)
    .onSettleFailure(markPaymentFailed);

  const advanced = routeConfig({ atomic: runtimeConfig.x402PriceAtomic, usd: INTELLIGENCE_PRICING.advancedReceipt.usd }, "Advanced Replate Intelligence report");
  advanced.extensions = {
    ...advanced.extensions,
    ...declareDiscoveryExtension({
      bodyType: "json",
      input: { receiptId: 1, receiptHash: "0x0000000000000000000000000000000000000000000000000000000000000000", userAddress: "0x0000000000000000000000000000000000000000" },
      inputSchema: { type: "object", required: ["receiptId", "receiptHash", "userAddress"], properties: { receiptId: { type: ["string", "number"] }, receiptHash: { type: "string", pattern: "^0x[a-fA-F0-9]{64}$" }, userAddress: { type: "string", pattern: "^0x[a-fA-F0-9]{40}$" } }, additionalProperties: false },
      output: { example: { success: true, receiptId: "1", report: {} } },
    }),
  };
  const routes = {
    [X402_ROUTE]: advanced,
    "POST /api/intelligence/bundle": routeConfig(INTELLIGENCE_PRICING.bundle, "Replate Intelligence bundle"),
    "GET /api/intelligence/basket/:receiptId": routeConfig(INTELLIGENCE_PRICING.basket, "Basket Intelligence"),
    "GET /api/intelligence/price/receipt/:receiptId": routeConfig(INTELLIGENCE_PRICING.receiptPrice, "Receipt Price Intelligence"),
    "GET /api/intelligence/price/product/:canonicalProductId": routeConfig(INTELLIGENCE_PRICING.productPrice, "Product Price Intelligence"),
    "GET /api/intelligence/behavior/me": routeConfig(INTELLIGENCE_PRICING.behavior, "Behavior Intelligence"),
    "GET /api/intelligence/recommendation/:receiptId": routeConfig(INTELLIGENCE_PRICING.recommendation, "Receipt Recommendations"),
  };
  return paymentMiddleware(routes, resourceServer);
}

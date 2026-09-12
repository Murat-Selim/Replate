import { Request, Response, Router } from "express";
import { INTELLIGENCE_PRICING, runtimeConfig } from "../config.js";
import { x402Configured } from "../services/x402.js";

const router = Router();
type Method = "GET" | "POST";
type Price = { usd: string; atomic: string };
type Input = { name: string; in: "path" | "json"; required: boolean; description: string };
type Capability = {
  id: string;
  name: string;
  method: Method;
  path: string;
  description: string;
  price?: Price;
  status: "live" | "soon";
  input: Input[];
  output: string[];
  authorization?: string;
};

function baseUrl(req: Request): string {
  const protocol = req.get("x-forwarded-proto")?.split(",")[0] || req.protocol;
  return `${protocol}://${req.get("host")}`;
}

function x402Metadata(price: Price = INTELLIGENCE_PRICING.advancedReceipt) {
  const facilitator = runtimeConfig.x402FacilitatorUrl || "https://api.cdp.coinbase.com/platform/v2/x402";
  return {
    version: 2,
    scheme: "exact",
    network: runtimeConfig.x402Network,
    asset: runtimeConfig.x402Asset,
    price: `$${price.usd}`,
    amountAtomic: price === INTELLIGENCE_PRICING.advancedReceipt ? runtimeConfig.x402PriceAtomic : price.atomic,
    payTo: runtimeConfig.x402PayTo,
    facilitator,
    builderCode: runtimeConfig.builderCode,
    paymentRequiredHeader: "PAYMENT-REQUIRED",
    paymentSignatureHeader: "PAYMENT-SIGNATURE",
    paymentResponseHeader: "PAYMENT-RESPONSE",
  };
}

const receiptPathInput = (name: string): Input[] => [{ name, in: "path", required: true, description: `Verified ${name}.` }];
const capabilities: Capability[] = [
  { id: "advancedReceipt", name: "Advanced Receipt Intelligence", method: "POST", path: "/api/intelligence/advanced", description: "Generate a comprehensive report for a verified receipt.", price: INTELLIGENCE_PRICING.advancedReceipt, status: "live", input: [
    { name: "receiptId", in: "json", required: true, description: "Verified receipt ID." },
    { name: "receiptHash", in: "json", required: true, description: "Verified receipt hash." },
    { name: "userAddress", in: "json", required: true, description: "Receipt owner and paying wallet." },
  ], output: ["report"], authorization: "receipt owner and x402 payer must match" },
  { id: "basket", name: "Basket Intelligence", method: "GET", path: "/api/intelligence/basket/{receiptId}", description: "Return structured basket metrics for a verified receipt.", price: INTELLIGENCE_PRICING.basket, status: "live", input: receiptPathInput("receiptId"), output: ["basketScore", "basketDiversity", "healthyItemRatio", "fruitVegRatio", "categories"], authorization: "x402 payer must own the receipt" },
  { id: "receiptPrice", name: "Receipt Price Intelligence", method: "GET", path: "/api/intelligence/price/receipt/{receiptId}", description: "Compare receipt item prices with observed product averages.", price: INTELLIGENCE_PRICING.receiptPrice, status: "live", input: receiptPathInput("receiptId"), output: ["items.paidPrice", "items.marketAverage", "items.priceScore", "items.dealScore", "items.sampleSize", "items.confidence"], authorization: "x402 payer must own the receipt" },
  { id: "productPrice", name: "Product Price Intelligence", method: "GET", path: "/api/intelligence/price/product/{canonicalProductId}", description: "Return aggregate historical price intelligence for a canonical product.", price: INTELLIGENCE_PRICING.productPrice, status: "live", input: receiptPathInput("canonicalProductId"), output: ["averagePrice", "minPrice", "maxPrice", "priceMomentum30d", "sampleSize", "confidence"] },
  { id: "behavior", name: "Behavior Intelligence", method: "GET", path: "/api/intelligence/behavior/me", description: "Return privacy-preserving purchase behavior for the paying wallet.", price: INTELLIGENCE_PRICING.behavior, status: "live", input: [], output: ["purchaseFrequency", "topCategories", "basketTrend", "repeatPurchaseRatio"], authorization: "x402 payer must be a registered wallet" },
  { id: "recommendation", name: "Receipt Recommendations", method: "GET", path: "/api/intelligence/recommendation/{receiptId}", description: "Return actionable price, basket, and nutrition recommendations.", price: INTELLIGENCE_PRICING.recommendation, status: "live", input: receiptPathInput("receiptId"), output: ["recommendations"], authorization: "x402 payer must own the receipt" },
  { id: "bundle", name: "Intelligence Bundle", method: "POST", path: "/api/intelligence/bundle", description: "Return selected basket, price, and recommendation resources in one paid request.", price: INTELLIGENCE_PRICING.bundle, status: "live", input: [
    { name: "receiptId", in: "json", required: true, description: "Verified receipt ID." },
    { name: "include", in: "json", required: false, description: "Any of basket, price, recommendation." },
  ], output: ["basket", "price", "recommendations"], authorization: "x402 payer must own the receipt" },
  { id: "productSignal", name: "Product Signal", method: "GET", path: "/api/signals/product/{canonicalProductId}", description: "Product signals are coming soon / Yakında.", price: INTELLIGENCE_PRICING.productSignal, status: "soon", input: receiptPathInput("canonicalProductId"), output: ["priceScore", "dealScore", "demandScore", "priceMomentum", "sampleSize", "confidence", "signalVersion", "calculationVersion"] },
  { id: "categorySignal", name: "Category Signal", method: "GET", path: "/api/signals/category/{category}", description: "Category signals are coming soon / Yakında.", price: INTELLIGENCE_PRICING.categorySignal, status: "soon", input: receiptPathInput("category"), output: ["priceMomentum30d", "demandMomentum30d", "observationCount", "confidence", "signalVersion", "calculationVersion"] },
  { id: "merchantSignal", name: "Merchant Signal", method: "GET", path: "/api/signals/merchant/{merchantId}", description: "Merchant signals are coming soon / Yakında.", price: INTELLIGENCE_PRICING.merchantSignal, status: "soon", input: receiptPathInput("merchantId"), output: ["average_basket_value", "price_competitiveness", "category_strength", "deal_frequency", "observation_count", "confidence"] },
];

function endpointDescription(capability: Capability): Record<string, unknown> {
  const operation: Record<string, unknown> = {
    operationId: capability.id,
    summary: capability.name,
    description: capability.description,
    "x-status": capability.status,
    responses: capability.status === "soon"
      ? { "501": { description: "This capability is coming soon / Yakında." } }
      : {
        "200": { description: "JSON intelligence response." },
        "402": { description: "Payment required; retry with PAYMENT-SIGNATURE." },
        "400": { description: "Invalid request." },
        "404": { description: "Resource not found." },
        "409": { description: "Data or signal is not ready." },
      },
  };
  if (capability.status === "live" && capability.price) {
    const payment = x402Metadata(capability.price);
    operation["x-payment-info"] = { price: { mode: "fixed", currency: "USDC", amount: capability.price.usd }, protocols: [{ x402: {} }] };
    operation.x402 = payment;
  }
  if (capability.method === "GET") {
    operation.parameters = capability.input.map((input) => ({ name: input.name, in: input.in, required: input.required, description: input.description, schema: { type: "string" } }));
  } else {
    operation.requestBody = {
      required: true,
      content: { "application/json": { schema: { type: "object", required: capability.input.filter((input) => input.required).map((input) => input.name), properties: Object.fromEntries(capability.input.map((input) => [input.name, { type: input.name === "include" ? "array" : "string", description: input.description }])) } } },
    };
  }
  return { [capability.method.toLowerCase()]: operation };
}

function agentManifest(origin: string) {
  const payment = x402Metadata();
  return {
    name: "Replate Intelligence",
    description: "Paid grocery receipt and aggregate commerce intelligence for users and autonomous agents via x402 on Base Mainnet.",
    url: origin,
    version: "1.0.0",
    capabilities: ["x402", "agent-native", "receipt-intelligence", "commerce-signals"],
    x402: { enabled: x402Configured, facilitator: payment.facilitator, network: payment.network, asset: "USDC", assetAddress: payment.asset, builderCode: payment.builderCode },
    agenticWallets: { compatible: true, skills: ["search-for-service", "pay-for-service"], installCommand: "npx skills add coinbase/agentic-wallet-skills" },
    endpoints: capabilities.map((capability) => ({
      path: capability.path,
      method: capability.method,
      status: capability.status,
      description: capability.description,
      payment: capability.status === "live" && capability.price ? x402Metadata(capability.price) : undefined,
      parameters: capability.input,
      output: capability.output,
      authorization: capability.authorization,
    })),
    tags: ["receipt", "grocery", "nutrition", "price", "signals", "intelligence", "x402", "agent-native"],
    builderCode: payment.builderCode,
    openapiUrl: `${origin}/openapi.json`,
  };
}

function openApiDocument(origin: string) {
  const payment = x402Metadata();
  return {
    openapi: "3.1.0",
    info: {
      title: "Replate Intelligence API",
      version: "1.0.0",
      description: "Paid receipt, personal, and aggregate commerce intelligence for autonomous agents.",
      "x-guidance": "Choose a capability from this document. Live paid endpoints return a 402 challenge; pay the listed USDC amount on Base Mainnet and retry with PAYMENT-SIGNATURE.",
    },
    servers: [{ url: origin }],
    paths: Object.fromEntries(capabilities.map((capability) => [capability.path, endpointDescription(capability)])),
    "x402": payment,
  };
}

router.get("/openapi.json", (req, res) => res.set("Cache-Control", "public, max-age=300").json(openApiDocument(baseUrl(req))));
router.get("/.well-known/agent.json", (req, res) => res.set("Cache-Control", "public, max-age=300").json(agentManifest(baseUrl(req))));
router.get("/.well-known/agent-card.json", (req: Request, res: Response) => {
  const origin = baseUrl(req);
  const payment = x402Metadata();
  res.set("Cache-Control", "public, max-age=300").json({
    name: "Replate Intelligence",
    description: "Paid grocery receipt and aggregate commerce intelligence available to users and autonomous agents.",
    url: origin,
    version: "1.0.0",
    protocolVersion: "0.3.0",
    documentationUrl: `${origin}/openapi.json`,
    capabilities: { streaming: false, pushNotifications: false, stateTransitionHistory: false },
    defaultInputModes: ["application/json"],
    defaultOutputModes: ["application/json"],
    skills: capabilities.filter((capability) => capability.status === "live").map((capability) => ({
      id: capability.id,
      name: capability.name,
      description: capability.description,
      tags: ["grocery", "intelligence", "x402"],
      examples: [`Use ${capability.method} ${capability.path}.`],
      inputModes: ["application/json"],
      outputModes: ["application/json"],
      endpoint: `${origin}${capability.path}`,
      x402: capability.price ? x402Metadata(capability.price) : undefined,
    })),
    openapiUrl: `${origin}/openapi.json`,
    x402: { ...payment, enabled: x402Configured },
  });
});

export default router;

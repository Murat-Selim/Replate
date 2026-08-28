import { Request, Response, Router } from "express";
import { runtimeConfig } from "../config.js";

const router = Router();

function baseUrl(req: Request): string {
  const protocol = req.get("x-forwarded-proto")?.split(",")[0] || req.protocol;
  return `${protocol}://${req.get("host")}`;
}

function x402Metadata() {
  const facilitator = runtimeConfig.x402FacilitatorUrl || "https://api.cdp.coinbase.com/platform/v2/x402";
  return {
    version: 2,
    scheme: "exact",
    network: runtimeConfig.x402Network,
    asset: runtimeConfig.x402Asset,
    price: `$${(Number(runtimeConfig.x402PriceAtomic) / 1_000_000).toFixed(2)}`,
    amountAtomic: runtimeConfig.x402PriceAtomic,
    payTo: runtimeConfig.x402PayTo,
    facilitator,
    builderCode: runtimeConfig.builderCode,
    paymentRequiredHeader: "PAYMENT-REQUIRED",
    paymentSignatureHeader: "PAYMENT-SIGNATURE",
    paymentResponseHeader: "PAYMENT-RESPONSE",
  };
}

function agentManifest(origin: string) {
  const payment = x402Metadata();
  return {
    name: "Replate Intelligence",
    description: "Paid grocery receipt intelligence for users and autonomous agents via x402 on Base Mainnet.",
    url: origin,
    version: "1.0.0",
    capabilities: ["x402", "agent-native"],
    x402: {
      enabled: true,
      facilitator: payment.facilitator,
      network: payment.network,
      asset: "USDC",
      assetAddress: payment.asset,
      builderCode: payment.builderCode,
    },
    agenticWallets: {
      compatible: true,
      skills: ["search-for-service", "pay-for-service"],
      installCommand: "npx skills add coinbase/agentic-wallet-skills",
      examplePrompts: [
        "Find a paid grocery intelligence service",
        "Generate the advanced intelligence report for my receipt",
        "Pay for my Replate intelligence report",
      ],
    },
    endpoints: [{
      path: "/api/intelligence/advanced",
      method: "POST",
      description: "Generate an advanced report for a verified grocery receipt. Pay via x402 on the first call.",
      payment: {
        scheme: payment.scheme,
        network: payment.network,
        asset: "USDC",
        assetAddress: payment.asset,
        amount: payment.price,
        amountAtomic: payment.amountAtomic,
        payTo: payment.payTo,
      },
      parameters: [
        { name: "receiptId", in: "json", required: true, description: "Verified receipt ID." },
        { name: "receiptHash", in: "json", required: true, description: "Verified receipt hash." },
        { name: "userAddress", in: "json", required: true, description: "Paying wallet and receipt owner." },
      ],
    }],
    tags: ["receipt", "grocery", "nutrition", "intelligence", "x402", "agent-native"],
    builderCode: payment.builderCode,
    openapiUrl: `${origin}/openapi.json`,
  };
}

function openApiDocument(origin: string) {
  return {
    openapi: "3.1.0",
    info: {
      title: "Replate Intelligence API",
      version: "1.0.0",
      description: "Paid receipt intelligence for users and autonomous agents.",
      "x-guidance": "Use POST /api/intelligence/advanced with a verified receiptId, receiptHash, and userAddress. The first request returns a 402 challenge; pay $0.10 USDC on Base Mainnet with an x402-compatible client, then retry with the payment signature.",
    },
    servers: [{ url: origin }],
    paths: {
      "/api/intelligence/advanced": {
        post: {
          operationId: "getAdvancedIntelligence",
          summary: "Generate an advanced receipt intelligence report",
          description: "The first request returns 402. An x402-compatible client pays with Base USDC and retries the request.",
          "x-payment-info": {
            price: { mode: "fixed", currency: "USD", amount: "0.10" },
            protocols: [{ x402: {} }],
          },
          x402: x402Metadata(),
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["receiptId", "receiptHash", "userAddress"],
                  properties: {
                    receiptId: { type: ["string", "integer"], description: "Verified receipt ID." },
                    receiptHash: { type: "string", pattern: "^0x[a-fA-F0-9]{64}$" },
                    userAddress: { type: "string", pattern: "^0x[a-fA-F0-9]{40}$", description: "The paying wallet and receipt owner." },
                  },
                },
              },
            },
          },
          responses: {
            "200": {
              description: "Advanced intelligence report",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    required: ["success", "receiptId", "report"],
                    properties: {
                      success: { type: "boolean" },
                      receiptId: { type: "string" },
                      report: { type: "object" },
                    },
                  },
                },
              },
              headers: { "PAYMENT-RESPONSE": { schema: { type: "string" } } },
            },
            "402": {
              description: "Payment required; retry with PAYMENT-SIGNATURE.",
              headers: { "PAYMENT-REQUIRED": { schema: { type: "string" } } },
            },
            "400": { description: "Invalid receipt request." },
            "404": { description: "Verified receipt not found." },
            "409": { description: "Receipt intelligence is not ready." },
          },
        },
      },
    },
  };
}

router.get("/openapi.json", (req, res) => {
  res.set("Cache-Control", "public, max-age=300").json(openApiDocument(baseUrl(req)));
});

router.get("/.well-known/agent.json", (req, res) => {
  res.set("Cache-Control", "public, max-age=300").json(agentManifest(baseUrl(req)));
});

router.get("/.well-known/agent-card.json", (req: Request, res: Response) => {
  const origin = baseUrl(req);
  res.set("Cache-Control", "public, max-age=300").json({
    name: "Replate Intelligence",
    description: "Paid grocery receipt intelligence available to users and autonomous agents.",
    url: origin,
    version: "1.0.0",
    protocolVersion: "0.3.0",
    documentationUrl: `${origin}/openapi.json`,
    capabilities: { streaming: false, pushNotifications: false, stateTransitionHistory: false },
    defaultInputModes: ["application/json"],
    defaultOutputModes: ["application/json"],
    skills: [{
      id: "advanced-receipt-intelligence",
      name: "Advanced Receipt Intelligence",
      description: "Analyze a verified grocery receipt and return health, nutrition, insight, and recommendation scores.",
      tags: ["receipt", "grocery", "nutrition", "intelligence", "x402"],
      examples: ["Generate the advanced intelligence report for my verified receipt."],
      inputModes: ["application/json"],
      outputModes: ["application/json"],
      endpoint: `${origin}/api/intelligence/advanced`,
      x402: x402Metadata(),
    }],
    openapiUrl: `${origin}/openapi.json`,
    x402: x402Metadata(),
  });
});

export default router;

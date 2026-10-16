import type { DeclareDiscoveryExtensionInput } from "@x402/extensions";
import { buildIntelligenceReport } from "./intelligence-rules.js";

type Schema = Record<string, unknown>;
const object = (properties: Record<string, Schema>) => ({ type: "object", properties, required: Object.keys(properties) });
const number = { type: "number" };
const text = { type: "string" };
const nullableNumber = { type: ["number", "null"] };
const currency = { type: ["string", "null"], description: "Currency of the source receipt; no currency conversion." };
const ratio = { type: "number", minimum: 0, maximum: 1 };
const score = { type: "number", minimum: 0, maximum: 100 };
const count = { type: "integer", minimum: 0 };
const array = (items: Schema) => ({ type: "array", items });
const receiptId = { type: "string", pattern: "^[0-9]+$", description: "A verified receipt ID owned by the x402 payer." };
const receiptHash = { type: "string", pattern: "^0x[a-fA-F0-9]{64}$" };
const address = { type: "string", pattern: "^0x[a-fA-F0-9]{40}$" };
const exampleHash = `0x${"0".repeat(64)}`;
const receiptOwner = "Only the verified receipt owner may pay for and access this resource. A third-party agent wallet has no delegated access.";
const walletOwner = "Only the verified x402 payer's own registered-wallet history is returned. No target wallet parameter or delegated access is supported.";
const path = { pathParams: { receiptId: "1" }, pathParamsSchema: object({ receiptId }) };
const success = { type: "boolean", const: true };
const insight = object({ type: { type: "string", enum: ["positive", "recommendation", "warning"] }, message: text, evidence: array(text) });
const lineItem = object({
  id: text, itemName: text, canonicalProductId: { type: ["string", "null"] }, canonicalKey: { type: ["string", "null"] },
  displayName: { type: ["string", "null"] }, category: text, paidPrice: nullableNumber, unitPrice: nullableNumber,
  priceUnit: text, quantity: number, weightGrams: number, spendingCategory: text, normalizationConfidence: ratio,
});
const reportSchema = object({
  receiptId, healthScore: score, nutritionScore: score, basketDiversity: number, processedFoodRatio: number,
  fruitVegRatio: number, proteinRatio: number, insights: array(insight), recommendations: array(insight),
  insightConfidence: ratio, ruleVersion: text,
  verification: object({ sourceVersion: text, hashAlgorithm: text, canonicalization: text, featureVersion: text,
    receiptHash, lineItemDigest: receiptHash, scores: object({ healthScore: score, nutritionScore: score }),
    lineItems: array(lineItem), sourceCommitment: receiptHash }),
});
const advancedInput = {
  ...object({ receiptId: { anyOf: [receiptId, { type: "integer", minimum: 1 }] }, receiptHash, userAddress: address }),
  additionalProperties: false,
};
const reportExample = {
  success: true, receiptId: "1", report: {
    ...buildIntelligenceReport({ health_score: 75, nutrition_score: 72, basket_diversity: 0.8,
      processed_food_ratio: 0.2, fruit_veg_ratio: 0.55, protein_ratio: 0.2 }),
    receiptId: "1", verification: { sourceVersion: "receipt-source-v2", hashAlgorithm: "sha256",
      canonicalization: "sorted-object-keys-v1", featureVersion: "features-v1", receiptHash: exampleHash,
      lineItemDigest: exampleHash, sourceCommitment: exampleHash, scores: { healthScore: 75, nutritionScore: 72 }, lineItems: [] },
  },
};
const spendingCategory = object({ category: text, amount: number, share: ratio, itemCount: count });
const historyCategory = object({ category: text, amount: number, share: ratio, recentAmount: number, previousAmount: number, shareChange: nullableNumber });

interface IntelligenceDiscovery {
  description: string;
  authorization: string;
  discovery: DeclareDiscoveryExtensionInput;
}

/** Static, synthetic examples only; no receipt rows, wallet history or credentials are read here. */
export const INTELLIGENCE_DISCOVERY: Record<string, IntelligenceDiscovery> = {
  advancedReceipt: {
    description: `Receipt health, nutrition, basket insights and recommendations with source commitments and line-item evidence. ${receiptOwner}`,
    authorization: receiptOwner,
    discovery: { bodyType: "json", input: { receiptId: "1", receiptHash: exampleHash, userAddress: `0x${"0".repeat(40)}` }, inputSchema: advancedInput,
      output: { schema: object({ success, receiptId, report: reportSchema }), example: reportExample } },
  },
  basket: {
    description: `Composition, diversity and balance scores for one verified grocery basket. ${receiptOwner}`,
    authorization: receiptOwner,
    discovery: { ...path, output: {
      schema: object({ success, receiptId, basketScore: score, basketDiversity: ratio, healthyItemRatio: ratio, fruitVegRatio: ratio, categories: { type: "object", additionalProperties: count } }),
      example: { success: true, receiptId: "1", basketScore: 74, basketDiversity: 0.8, healthyItemRatio: 0.6, fruitVegRatio: 0.55, categories: { healthy: 3, neutral: 2 } },
    } },
  },
  productPrice: {
    description: `Paid product prices and quantities from one verified receipt in a single call, in its original currency. ${receiptOwner}`,
    authorization: receiptOwner,
    discovery: { ...path, output: {
      schema: object({ success, receiptId, currencyCode: currency, products: array(object({
        id: text, name: text, canonicalProductId: { type: ["string", "null"] }, category: text,
        quantity: number, currencyCode: currency, paidPrice: nullableNumber, unitPrice: nullableNumber, priceUnit: text,
      })) }),
      example: { success: true, receiptId: "1", currencyCode: "USD", products: [
        { id: "1", name: "Example apples", canonicalProductId: null, category: "healthy", quantity: 1, currencyCode: "USD", paidPrice: 3, unitPrice: 3, priceUnit: "each" },
      ] },
    } },
  },
  receiptSpendingBreakdown: {
    description: `Spending amounts and category shares for one verified receipt, in its original currency. ${receiptOwner}`,
    authorization: receiptOwner,
    discovery: { ...path, output: {
      schema: object({ success, receiptId, currencyCode: currency, receiptTotal: nullableNumber, pricedItemsTotal: number, pricedItemCount: count, totalLineItemCount: count, categories: array(spendingCategory) }),
      example: { success: true, receiptId: "1", currencyCode: "USD", receiptTotal: 3, pricedItemsTotal: 3, pricedItemCount: 1, totalLineItemCount: 1, categories: [{ category: "produce", amount: 3, share: 1, itemCount: 1 }] },
    } },
  },
  behavior: {
    description: `Personal purchase frequency, leading categories, basket trends and repeat-purchase ratio. ${walletOwner}`,
    authorization: walletOwner,
    discovery: { input: {}, inputSchema: { ...object({}), additionalProperties: false }, output: {
      schema: object({ success, purchaseFrequency: { type: "object", additionalProperties: count }, topCategories: array(text), basketTrend: { type: "string", enum: ["improving", "declining", "stable"] }, repeatPurchaseRatio: ratio }),
      example: { success: true, purchaseFrequency: { "Example apples": 2 }, topCategories: ["produce"], basketTrend: "stable", repeatPurchaseRatio: 0.5 },
    } },
  },
  spendingBreakdown: {
    description: `Personal grocery spending, food and household totals and 30-day changes grouped by original currency. ${walletOwner}`,
    authorization: walletOwner,
    discovery: { input: {}, inputSchema: { ...object({}), additionalProperties: false }, output: {
      schema: object({ success, currencies: array(object({ currencyCode: currency, totalSpent: number, averageReceiptSpend: number,
        receiptCount: count, exactReceiptCount: count, lineItemEstimateCount: count, foodSpend: number, householdSpend: number,
        categories: array(historyCategory), last30Days: object({ spent: number, previous30Days: number, change: nullableNumber }) })) }),
      example: { success: true, currencies: [{ currencyCode: "USD", totalSpent: 3, averageReceiptSpend: 3, receiptCount: 1,
        exactReceiptCount: 1, lineItemEstimateCount: 0, foodSpend: 3, householdSpend: 0,
        categories: [{ category: "produce", amount: 3, share: 1, recentAmount: 3, previousAmount: 0, shareChange: null }],
        last30Days: { spent: 3, previous30Days: 0, change: null } }] },
    } },
  },
};

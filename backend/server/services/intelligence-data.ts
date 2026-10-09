import { createHash } from "crypto";
import type { PoolClient } from "pg";
import { buildIntelligenceReport, type IntelligenceFeatureSet } from "./intelligence-rules.js";
import { getSpendingCategory } from "./spending-categories.js";

type Db = Pick<PoolClient, "query">;

export interface ReceiptSummary {
  id: string;
  receiptHash: string;
  walletAddress: string;
  healthScore: number;
  nutritionScore: number;
  totalItems: number;
  fruitVegGrams: number;
  daysCovered: number;
  verifiedAt: string;
  currencyCode: string | null;
  storeName: string | null;
  totalSpent: number | null;
  totalSpentSource: "receipt_total" | "line_items" | null;
  expectedItemsTotal?: number | null;
}

export interface ReceiptItemIntelligence {
  id: string;
  itemName: string;
  canonicalProductId: string | null;
  canonicalKey: string | null;
  displayName: string | null;
  category: string;
  paidPrice: number | null;
  unitPrice: number | null;
  priceUnit: string;
  quantity: number;
  weightGrams: number;
  spendingCategory: string;
  normalizationConfidence: number;
}

const ADVANCED_SOURCE_VERSION = "receipt-source-v2";

export type AdvancedReceiptReport = ReturnType<typeof buildIntelligenceReport> & {
  receiptId: string;
  verification: {
    sourceVersion: string;
    hashAlgorithm: string;
    canonicalization: string;
    featureVersion: string;
    receiptHash: string;
    lineItemDigest: string;
    scores: { healthScore: number; nutritionScore: number };
    lineItems: ReceiptItemIntelligence[];
    sourceCommitment: string;
  };
};

export interface BasketIntelligence {
  receiptId: string;
  basketScore: number;
  basketDiversity: number;
  healthyItemRatio: number;
  fruitVegRatio: number;
  categories: Record<string, number>;
}

export interface ReceiptProductPrice {
  id: string;
  name: string;
  canonicalProductId: string | null;
  category: string;
  quantity: number;
  currencyCode: string | null;
  paidPrice: number | null;
  unitPrice: number | null;
  priceUnit: string;
}

export interface SpendingBreakdown {
  currencies: Array<{
    currencyCode: string | null;
    totalSpent: number;
    averageReceiptSpend: number;
    receiptCount: number;
    exactReceiptCount: number;
    lineItemEstimateCount: number;
    foodSpend: number;
    householdSpend: number;
    categories: Array<{ category: string; amount: number; share: number; recentAmount: number; previousAmount: number; shareChange: number | null }>;
    last30Days: { spent: number; previous30Days: number; change: number | null };
  }>;
}

export interface ReceiptSpendingBreakdown {
  receiptId: string;
  currencyCode: string | null;
  receiptTotal: number | null;
  pricedItemsTotal: number;
  pricedItemCount: number;
  totalLineItemCount: number;
  categories: Array<{ category: string; amount: number; share: number; itemCount: number }>;
}

export interface BehaviorIntelligence {
  purchaseFrequency: Record<string, number>;
  topCategories: string[];
  basketTrend: "improving" | "declining" | "stable";
  repeatPurchaseRatio: number;
}

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value));
}

function round(value: number, decimals = 2): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

export async function findReceipt(db: Db, receiptId: string, wallet?: string, receiptHash?: string): Promise<ReceiptSummary | null> {
  const result = await db.query(
    `SELECT r.id, r.receipt_hash, u.wallet_address, r.health_score, r.nutrition_score,
            r.total_items, r.fruit_veg_grams, r.days_covered, r.verified_at
            ,r.currency_code, r.store_name, r.total_spent, r.total_spent_source,
            (SELECT df.feature_value FROM derived_features df WHERE df.receipt_id = r.id
              AND df.feature_name = 'receipt_item_total' AND df.calculation_version = 'receipt-prices-v1') AS expected_items_total
     FROM receipts r JOIN users u ON u.id = r.user_id
     WHERE r.id = $1
       AND ($2::TEXT IS NULL OR lower(u.wallet_address) = lower($2))
       AND ($3::TEXT IS NULL OR lower(r.receipt_hash) = lower($3))`,
    [receiptId, wallet || null, receiptHash || null],
  );
  const row = result.rows[0];
  return row ? {
    id: String(row.id),
    receiptHash: row.receipt_hash,
    walletAddress: row.wallet_address,
    healthScore: Number(row.health_score),
    nutritionScore: Number(row.nutrition_score),
    totalItems: Number(row.total_items),
    fruitVegGrams: Number(row.fruit_veg_grams),
    daysCovered: Number(row.days_covered),
    verifiedAt: new Date(row.verified_at).toISOString(),
    currencyCode: row.currency_code,
    storeName: row.store_name,
    totalSpent: row.total_spent === null ? null : Number(row.total_spent),
    totalSpentSource: row.total_spent_source,
    expectedItemsTotal: row.expected_items_total == null ? null : Number(row.expected_items_total),
  } : null;
}

export async function receiptFeatures(db: Db, receiptId: string): Promise<IntelligenceFeatureSet> {
  const result = await db.query<{ feature_name: string; feature_value: string }>(
    "SELECT feature_name, feature_value FROM derived_features WHERE receipt_id = $1 AND calculation_version = 'features-v1'",
    [receiptId],
  );
  return Object.fromEntries(result.rows.map((row) => [row.feature_name, Number(row.feature_value)])) as unknown as IntelligenceFeatureSet;
}

export async function receiptItems(db: Db, receiptId: string): Promise<ReceiptItemIntelligence[]> {
  const result = await db.query(
    `SELECT ri.id, ri.item_name, ri.canonical_product_id, cp.canonical_key, cp.display_name,
            COALESCE(c.category, cp.category, 'unknown') AS category,
            ri.paid_price, COALESCE(ri.unit_price, ri.paid_price) AS unit_price,
            ri.quantity, ri.weight_grams,
            COALESCE(ri.price_unit, 'each') AS price_unit, ri.spending_category,
            ri.normalization_confidence
     FROM receipt_items ri
     LEFT JOIN canonical_products cp ON cp.id = ri.canonical_product_id
     LEFT JOIN classifications c ON c.receipt_item_id = ri.id
     WHERE ri.receipt_id = $1
     ORDER BY ri.id`,
    [receiptId],
  );
  return result.rows.map((row) => ({
    id: String(row.id),
    itemName: row.item_name,
    canonicalProductId: row.canonical_product_id === null ? null : String(row.canonical_product_id),
    canonicalKey: row.canonical_key,
    displayName: row.display_name,
    category: row.category,
    paidPrice: row.paid_price === null ? null : Number(row.paid_price),
    unitPrice: row.unit_price === null ? null : Number(row.unit_price),
    priceUnit: row.price_unit,
    quantity: Number(row.quantity),
    weightGrams: Number(row.weight_grams),
    spendingCategory: row.spending_category,
    normalizationConfidence: Number(row.normalization_confidence || 0),
  }));
}

export async function buildBasketIntelligence(db: Db, receiptId: string, wallet: string): Promise<BasketIntelligence | null> {
  const receipt = await findReceipt(db, receiptId, wallet);
  if (!receipt) return null;
  const features = await receiptFeatures(db, receiptId);
  const items = await receiptItems(db, receiptId);
  const categories = items.reduce<Record<string, number>>((result, item) => {
    result[item.category] = (result[item.category] || 0) + 1;
    return result;
  }, {});
  const total = Math.max(1, receipt.totalItems);
  const diversity = new Set(items.map((item) => item.canonicalProductId || item.itemName.toLowerCase())).size / total;
  const healthy = Number.isFinite(features.healthy_item_ratio) ? features.healthy_item_ratio! : (categories.healthy || 0) / total;
  const fruitVeg = Number.isFinite(features.fruit_veg_ratio) ? features.fruit_veg_ratio : 0;
  return {
    receiptId,
    basketScore: Math.round(clamp(receipt.healthScore * 0.5 + receipt.nutritionScore * 0.3 + clamp(diversity * 100) * 0.2)),
    basketDiversity: round(clamp(diversity, 0, 1)),
    healthyItemRatio: round(clamp(healthy, 0, 1)),
    fruitVegRatio: round(clamp(fruitVeg, 0, 1)),
    categories,
  };
}

export async function buildReceiptProductPrices(db: Db, receiptId: string, wallet: string): Promise<{ receiptId: string; currencyCode: string | null; products: ReceiptProductPrice[] } | null> {
  const receipt = await findReceipt(db, receiptId, wallet);
  if (!receipt) return null;
  const items = await receiptItems(db, receipt.id);
  return {
    receiptId: receipt.id,
    currencyCode: receipt.currencyCode,
    products: items.filter((item) => item.paidPrice !== null).map((item) => ({
      id: item.id,
      name: item.displayName || item.itemName,
      canonicalProductId: item.canonicalProductId,
      category: item.category,
      quantity: item.quantity,
      currencyCode: receipt.currencyCode,
      paidPrice: item.paidPrice,
      unitPrice: item.unitPrice,
      priceUnit: item.priceUnit,
    })),
  };
}

export async function buildBehaviorIntelligence(db: Db, wallet: string): Promise<BehaviorIntelligence> {
  const frequency = await db.query(
    `SELECT COALESCE(cp.display_name, ri.item_name) AS item_name, COUNT(*) AS item_count
     FROM receipt_items ri
     JOIN receipts r ON r.id = ri.receipt_id
     JOIN users u ON u.id = r.user_id
     LEFT JOIN canonical_products cp ON cp.id = ri.canonical_product_id
     WHERE lower(u.wallet_address) = lower($1)
     GROUP BY COALESCE(cp.display_name, ri.item_name)
     ORDER BY item_count DESC, item_name ASC`,
    [wallet],
  );
  const categories = await db.query(
    `SELECT ri.spending_category AS category, COUNT(*) AS item_count
     FROM receipt_items ri
     JOIN receipts r ON r.id = ri.receipt_id
     JOIN users u ON u.id = r.user_id
     WHERE lower(u.wallet_address) = lower($1)
     GROUP BY ri.spending_category
     ORDER BY item_count DESC, category ASC LIMIT 5`,
    [wallet],
  );
  const trend = await db.query(
    `SELECT AVG(r.health_score) FILTER (WHERE r.verified_at >= NOW() - INTERVAL '30 days') AS current_score,
            AVG(r.health_score) FILTER (WHERE r.verified_at >= NOW() - INTERVAL '60 days' AND r.verified_at < NOW() - INTERVAL '30 days') AS previous_score
     FROM receipts r JOIN users u ON u.id = r.user_id
     WHERE lower(u.wallet_address) = lower($1)`,
    [wallet],
  );
  const current = Number(trend.rows[0]?.current_score || 0);
  const previous = Number(trend.rows[0]?.previous_score || 0);
  const itemCounts = frequency.rows.map((row) => Number(row.item_count));
  const total = itemCounts.reduce((sum, count) => sum + count, 0);
  const repeated = itemCounts.reduce((sum, count) => sum + Math.max(0, count - 1), 0);
  const topFrequency = frequency.rows.slice(0, 10);
  return {
    purchaseFrequency: Object.fromEntries(topFrequency.map((row) => [row.item_name, Number(row.item_count)])),
    topCategories: categories.rows.map((row) => row.category),
    basketTrend: current > previous + 2 ? "improving" : current + 2 < previous ? "declining" : "stable",
    repeatPurchaseRatio: round(total ? repeated / total : 0, 4),
  };
}

export async function buildSpendingBreakdown(db: Db, wallet: string): Promise<SpendingBreakdown> {
  const [receipts, categories] = await Promise.all([
    db.query(
      `SELECT r.currency_code, SUM(r.total_spent) AS total_spent, AVG(r.total_spent) AS average_receipt_spend,
              COUNT(*) AS receipt_count,
              COUNT(*) FILTER (WHERE r.total_spent_source = 'receipt_total') AS exact_receipt_count,
              COUNT(*) FILTER (WHERE r.total_spent_source = 'line_items') AS line_item_estimate_count,
              SUM(r.total_spent) FILTER (WHERE r.verified_at >= NOW() - INTERVAL '30 days') AS recent_spend,
              SUM(r.total_spent) FILTER (WHERE r.verified_at >= NOW() - INTERVAL '60 days' AND r.verified_at < NOW() - INTERVAL '30 days') AS previous_spend
       FROM receipts r JOIN users u ON u.id = r.user_id
       WHERE lower(u.wallet_address) = lower($1) AND r.total_spent IS NOT NULL
       GROUP BY r.currency_code ORDER BY r.currency_code NULLS LAST`,
      [wallet],
    ),
    db.query(
      `SELECT r.currency_code, ri.spending_category AS category,
              SUM(ri.paid_price) AS amount,
              SUM(ri.paid_price) FILTER (WHERE r.verified_at >= NOW() - INTERVAL '30 days') AS recent_amount,
              SUM(ri.paid_price) FILTER (WHERE r.verified_at >= NOW() - INTERVAL '60 days' AND r.verified_at < NOW() - INTERVAL '30 days') AS previous_amount
       FROM receipt_items ri JOIN receipts r ON r.id = ri.receipt_id JOIN users u ON u.id = r.user_id
       WHERE lower(u.wallet_address) = lower($1) AND ri.paid_price IS NOT NULL
       GROUP BY r.currency_code, ri.spending_category ORDER BY r.currency_code NULLS LAST, amount DESC`,
      [wallet],
    ),
  ]);
  return {
    currencies: receipts.rows.map((row) => {
      const currencyCategories = categories.rows.filter((item) => item.currency_code === row.currency_code);
      const categoryTotal = currencyCategories.reduce((sum, item) => sum + Number(item.amount || 0), 0);
      const recentCategoryTotal = currencyCategories.reduce((sum, item) => sum + Number(item.recent_amount || 0), 0);
      const previousCategoryTotal = currencyCategories.reduce((sum, item) => sum + Number(item.previous_amount || 0), 0);
      const foodSpend = currencyCategories.filter((item) => item.category !== "household").reduce((sum, item) => sum + Number(item.amount || 0), 0);
      const householdSpend = categoryTotal - foodSpend;
      const recentSpend = Number(row.recent_spend || 0);
      const previousSpend = Number(row.previous_spend || 0);
      return {
        currencyCode: row.currency_code,
        totalSpent: round(Number(row.total_spent || 0)),
        averageReceiptSpend: round(Number(row.average_receipt_spend || 0)),
        receiptCount: Number(row.receipt_count),
        exactReceiptCount: Number(row.exact_receipt_count || 0),
        lineItemEstimateCount: Number(row.line_item_estimate_count || 0),
        foodSpend: round(foodSpend),
        householdSpend: round(householdSpend),
        categories: currencyCategories.map((item) => ({
          category: item.category,
          amount: round(Number(item.amount || 0)),
          share: round(categoryTotal ? Number(item.amount || 0) / categoryTotal : 0),
          recentAmount: round(Number(item.recent_amount || 0)),
          previousAmount: round(Number(item.previous_amount || 0)),
          shareChange: previousCategoryTotal > 0
            ? round(Number(item.recent_amount || 0) / Math.max(recentCategoryTotal, 1) - Number(item.previous_amount || 0) / previousCategoryTotal, 4)
            : null,
        })),
        last30Days: {
          spent: round(recentSpend),
          previous30Days: round(previousSpend),
          change: previousSpend > 0 ? round(recentSpend / previousSpend - 1, 4) : null,
        },
      };
    }),
  };
}

export async function buildReceiptSpendingBreakdown(db: Db, receiptId: string, wallet: string): Promise<ReceiptSpendingBreakdown | null> {
  const receipt = await findReceipt(db, receiptId, wallet);
  if (!receipt) return null;
  const items = await receiptItems(db, receipt.id);
  const pricedItems = items.filter((item) => item.paidPrice !== null);
  const categoryTotals = new Map<string, { amount: number; itemCount: number }>();
  for (const item of pricedItems) {
    const storedCategory = (item.spendingCategory || "").trim();
    const detectedCategory = getSpendingCategory(item.itemName, item.category === "excluded");
    // Apply current product rules to old automatic labels, retaining labels for unknown products.
    const category = detectedCategory !== "other" ? detectedCategory : storedCategory || "other";
    const total = categoryTotals.get(category) || { amount: 0, itemCount: 0 };
    total.amount += item.paidPrice!;
    total.itemCount++;
    categoryTotals.set(category, total);
  }
  const pricedItemsTotal = [...categoryTotals.values()].reduce((sum, category) => sum + category.amount, 0);
  return {
    receiptId: receipt.id,
    currencyCode: receipt.currencyCode,
    receiptTotal: receipt.totalSpent,
    pricedItemsTotal: round(pricedItemsTotal),
    pricedItemCount: pricedItems.length,
    totalLineItemCount: items.length,
    categories: [...categoryTotals.entries()]
      .map(([category, total]) => ({
        category,
        amount: round(total.amount),
        share: round(pricedItemsTotal ? total.amount / pricedItemsTotal : 0),
        itemCount: total.itemCount,
      }))
      .sort((a, b) => b.amount - a.amount),
  };
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value as Record<string, unknown>).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson((value as Record<string, unknown>)[key])}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

function digest(value: unknown): string {
  return `0x${createHash("sha256").update(canonicalJson(value)).digest("hex")}`;
}

export async function buildAdvancedReceiptReport(db: Db, receiptId: string, receiptHash?: string): Promise<AdvancedReceiptReport | null> {
  const receipt = await findReceipt(db, receiptId, undefined, receiptHash);
  if (!receipt) return null;
  const features = await receiptFeatures(db, receipt.id);
  if (Object.keys(features).length < 11) return null;
  const report = buildIntelligenceReport(features);
  const lineItems = await receiptItems(db, receipt.id);
  const lineItemDigest = digest(lineItems);
  const scores = { healthScore: report.healthScore, nutritionScore: report.nutritionScore };
  const sourceCommitment = digest({
    sourceVersion: ADVANCED_SOURCE_VERSION,
    hashAlgorithm: "sha256",
    canonicalization: "sorted-object-keys-v1",
    featureVersion: "features-v1",
    receiptId: receipt.id,
    receiptHash: receipt.receiptHash,
    lineItemDigest,
    scores,
    ruleVersion: report.ruleVersion,
  });
  return {
    ...report,
    receiptId: receipt.id,
    verification: {
      sourceVersion: ADVANCED_SOURCE_VERSION,
      hashAlgorithm: "sha256",
      canonicalization: "sorted-object-keys-v1",
      featureVersion: "features-v1",
      receiptHash: receipt.receiptHash,
      lineItemDigest,
      scores,
      lineItems,
      sourceCommitment,
    },
  };
}

export function hasAdvancedReceiptBinding(value: unknown, sourceCommitment?: string | null): value is AdvancedReceiptReport {
  if (!value || typeof value !== "object") return false;
  const report = value as Partial<AdvancedReceiptReport>;
  const verification = report.verification;
  if (!verification) return false;
  return typeof report.receiptId === "string"
    && typeof verification.receiptHash === "string"
    && typeof verification.lineItemDigest === "string"
    && typeof verification.sourceCommitment === "string"
    && (!sourceCommitment || verification.sourceCommitment === sourceCommitment);
}

export function buildAdvancedFromFeatures(features: IntelligenceFeatureSet) {
  return buildIntelligenceReport(features);
}

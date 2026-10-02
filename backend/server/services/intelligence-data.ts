import { createHash } from "crypto";
import type { PoolClient } from "pg";
import { buildIntelligenceReport, type IntelligenceFeatureSet } from "./intelligence-rules.js";

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

export interface ReceiptPriceAnalysis {
  receiptId: string;
  currencyCode: string | null;
  storeName: string | null;
  items: Array<{
    canonicalProductId: string | null;
    itemName: string;
    paidPrice: number | null;
    unitPrice: number | null;
    priceUnit: string;
    marketAverage: number | null;
    priceScore: number | null;
    dealScore: number | null;
    sampleSize: number;
    confidence: number;
  }>;
}

export interface ProductPriceIntelligence {
  canonicalProductId: string;
  currencyCode: string | null;
  priceUnit: string;
  averagePrice: number;
  minPrice: number;
  maxPrice: number;
  priceMomentum30d: number | null;
  sampleSize: number;
  confidence: number;
  storePrices: Array<{ storeName: string; averagePrice: number; sampleSize: number }>;
  observations: Array<{ date: string; unitPrice: number; storeName: string | null }>;
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

export interface BehaviorIntelligence {
  purchaseFrequency: Record<string, number>;
  topCategories: string[];
  basketTrend: "improving" | "declining" | "stable";
  repeatPurchaseRatio: number;
}

export interface Recommendation {
  type: "PRICE" | "BASKET" | "NUTRITION" | "BUDGET" | "PURCHASE_TIMING" | "PRODUCT_ALTERNATIVE";
  priority: "low" | "medium" | "high";
  message: string;
}

export interface BundleIntelligence {
  receiptId: string;
  basket?: BasketIntelligence;
  price?: ReceiptPriceAnalysis;
  recommendations?: Recommendation[];
  behavior?: BehaviorIntelligence;
  productPrices?: ProductPriceIntelligence[];
  spending?: SpendingBreakdown;
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
            ,r.currency_code, r.store_name, r.total_spent, r.total_spent_source
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

async function priceAggregates(
  db: Db,
  scopes: Array<{ productId: string; priceUnit: string }>,
  currencyCode: string | null,
): Promise<Map<string, { average: number; sampleSize: number }>> {
  if (scopes.length === 0) return new Map();
  const result = await db.query(
    `SELECT ri.canonical_product_id, COALESCE(ri.price_unit, 'each') AS price_unit,
            AVG(COALESCE(ri.unit_price, ri.paid_price)) AS average_price,
            COUNT(*) AS sample_size
     FROM receipt_items ri JOIN receipts r ON r.id = ri.receipt_id
     JOIN unnest($1::BIGINT[], $2::TEXT[]) AS scope(product_id, price_unit)
       ON scope.product_id = ri.canonical_product_id AND scope.price_unit = COALESCE(ri.price_unit, 'each')
     WHERE ri.paid_price IS NOT NULL AND r.currency_code IS NOT DISTINCT FROM $3
     GROUP BY ri.canonical_product_id, COALESCE(ri.price_unit, 'each')`,
    [scopes.map((scope) => scope.productId), scopes.map((scope) => scope.priceUnit), currencyCode],
  );
  return new Map(result.rows.map((row) => [`${row.canonical_product_id}:${row.price_unit}`, {
    average: Number(row.average_price),
    sampleSize: Number(row.sample_size),
  }]));
}

export async function buildReceiptPriceAnalysis(db: Db, receiptId: string, wallet: string): Promise<ReceiptPriceAnalysis | null> {
  const receipt = await findReceipt(db, receiptId, wallet);
  if (!receipt) return null;
  const items = await receiptItems(db, receiptId);
  const scopes = [...new Map(items.flatMap((item) => item.canonicalProductId
    ? [[`${item.canonicalProductId}:${item.priceUnit}`, { productId: item.canonicalProductId, priceUnit: item.priceUnit }]]
    : [])).values()];
  const aggregates = await priceAggregates(db, scopes, receipt.currencyCode);
  return {
    receiptId,
    currencyCode: receipt.currencyCode,
    storeName: receipt.storeName,
    items: items.map((item) => {
      const aggregate = item.canonicalProductId ? aggregates.get(`${item.canonicalProductId}:${item.priceUnit}`) : undefined;
      if (item.paidPrice === null || item.unitPrice === null || !aggregate || aggregate.average <= 0) {
        return { canonicalProductId: item.canonicalProductId, itemName: item.itemName, paidPrice: item.paidPrice, unitPrice: item.unitPrice, priceUnit: item.priceUnit, marketAverage: aggregate?.average ?? null, priceScore: null, dealScore: null, sampleSize: aggregate?.sampleSize ?? 0, confidence: 0 };
      }
      const relativeDifference = (item.unitPrice - aggregate.average) / aggregate.average;
      return {
        canonicalProductId: item.canonicalProductId,
        itemName: item.itemName,
        paidPrice: round(item.paidPrice),
        unitPrice: round(item.unitPrice, 4),
        priceUnit: item.priceUnit,
        marketAverage: round(aggregate.average),
        priceScore: Math.round(clamp(100 - Math.abs(relativeDifference) * 100)),
        dealScore: Math.round(clamp(100 - relativeDifference * 100)),
        sampleSize: aggregate.sampleSize,
        confidence: round(Math.min(1, (0.5 + aggregate.sampleSize / 500) * item.normalizationConfidence)),
      };
    }),
  };
}

export async function buildProductPriceIntelligence(db: Db, productId: string, currencyCode: string | null, priceUnit: string): Promise<ProductPriceIntelligence | null> {
  const result = await db.query(
    `SELECT AVG(COALESCE(ri.unit_price, ri.paid_price)) AS average_price,
            MIN(COALESCE(ri.unit_price, ri.paid_price)) AS min_price,
            MAX(COALESCE(ri.unit_price, ri.paid_price)) AS max_price,
            COUNT(*) AS sample_size,
            AVG(COALESCE(ri.unit_price, ri.paid_price)) FILTER (WHERE r.verified_at >= NOW() - INTERVAL '30 days') AS current_average,
            AVG(COALESCE(ri.unit_price, ri.paid_price)) FILTER (WHERE r.verified_at >= NOW() - INTERVAL '60 days' AND r.verified_at < NOW() - INTERVAL '30 days') AS previous_average
     FROM receipt_items ri JOIN receipts r ON r.id = ri.receipt_id
     WHERE ri.canonical_product_id = $1 AND ri.paid_price IS NOT NULL
       AND r.currency_code IS NOT DISTINCT FROM $2 AND COALESCE(ri.price_unit, 'each') = $3`,
    [productId, currencyCode, priceUnit],
  );
  const row = result.rows[0];
  const sampleSize = Number(row?.sample_size || 0);
  if (!sampleSize) return null;
  const stores = await db.query(
    `SELECT r.store_name, AVG(COALESCE(ri.unit_price, ri.paid_price)) AS average_price, COUNT(*) AS sample_size
     FROM receipt_items ri JOIN receipts r ON r.id = ri.receipt_id
     WHERE ri.canonical_product_id = $1 AND ri.paid_price IS NOT NULL
       AND r.currency_code IS NOT DISTINCT FROM $2 AND COALESCE(ri.price_unit, 'each') = $3
       AND r.store_name IS NOT NULL
     GROUP BY r.store_name ORDER BY average_price, r.store_name`,
    [productId, currencyCode, priceUnit],
  );
  const observations = await db.query(
    `SELECT TO_CHAR(r.receipt_date, 'YYYY-MM-DD') AS date,
            COALESCE(ri.unit_price, ri.paid_price) AS unit_price, r.store_name
     FROM receipt_items ri JOIN receipts r ON r.id = ri.receipt_id
     WHERE ri.canonical_product_id = $1 AND ri.paid_price IS NOT NULL
       AND r.currency_code IS NOT DISTINCT FROM $2 AND COALESCE(ri.price_unit, 'each') = $3
     ORDER BY r.receipt_date DESC, ri.id DESC LIMIT 20`,
    [productId, currencyCode, priceUnit],
  );
  const averagePrice = Number(row.average_price);
  const currentAverage = row.current_average === null ? null : Number(row.current_average);
  const previousAverage = row.previous_average === null ? null : Number(row.previous_average);
  return {
    canonicalProductId: productId,
    currencyCode,
    priceUnit,
    averagePrice: round(averagePrice),
    minPrice: round(Number(row.min_price)),
    maxPrice: round(Number(row.max_price)),
    priceMomentum30d: currentAverage !== null && previousAverage !== null && previousAverage > 0
      ? round(currentAverage / previousAverage - 1, 4)
      : null,
    sampleSize,
    confidence: round(Math.min(1, 0.5 + sampleSize / 500)),
    storePrices: stores.rows.map((store) => ({ storeName: store.store_name, averagePrice: round(Number(store.average_price), 4), sampleSize: Number(store.sample_size) })),
    observations: observations.rows.reverse().map((item) => ({ date: item.date, unitPrice: round(Number(item.unit_price), 4), storeName: item.store_name })),
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

export async function buildRecommendations(db: Db, receiptId: string, wallet: string): Promise<Recommendation[] | null> {
  const basket = await buildBasketIntelligence(db, receiptId, wallet);
  const prices = await buildReceiptPriceAnalysis(db, receiptId, wallet);
  if (!basket || !prices) return null;
  const recommendations: Recommendation[] = [];
  const items = await receiptItems(db, receiptId);
  const itemSpend = items.reduce((sum, item) => sum + (item.paidPrice || 0), 0);
  const snackSpend = items.filter((item) => item.spendingCategory === "snacks").reduce((sum, item) => sum + (item.paidPrice || 0), 0);
  if (itemSpend > 0 && snackSpend / itemSpend > 0.25) {
    recommendations.push({ type: "BUDGET", priority: "low", message: `Snacks account for ${Math.round(snackSpend / itemSpend * 100)}% of recognized line-item spend in this basket.` });
  }
  if (prices.items.some((item) => item.priceScore !== null && item.priceScore < 50)) {
    recommendations.push({ type: "PRICE", priority: "medium", message: "One or more items are priced well above their historical observed average." });
  }
  if (basket.basketDiversity < 0.5) {
    recommendations.push({ type: "BASKET", priority: "low", message: "Basket diversity is below the recommended variety threshold." });
  }
  if (basket.fruitVegRatio < 0.5 || basket.healthyItemRatio < 0.5) {
    recommendations.push({ type: "NUTRITION", priority: "medium", message: "Add more fruit, vegetables, and whole-food staples to improve basket balance." });
  }
  return recommendations;
}

export async function buildBundle(db: Db, receiptId: string, wallet: string, include: string[]): Promise<BundleIntelligence | null> {
  if (!await findReceipt(db, receiptId, wallet)) return null;
  const allowed = new Set(include.length ? include : ["basket", "price", "recommendation", "behavior", "productPrice", "spending"]);
  const bundle: BundleIntelligence = { receiptId };
  if (allowed.has("basket")) bundle.basket = (await buildBasketIntelligence(db, receiptId, wallet)) || undefined;
  if (allowed.has("price")) bundle.price = (await buildReceiptPriceAnalysis(db, receiptId, wallet)) || undefined;
  if (allowed.has("recommendation")) bundle.recommendations = (await buildRecommendations(db, receiptId, wallet)) || undefined;
  if (allowed.has("behavior")) bundle.behavior = await buildBehaviorIntelligence(db, wallet);
  if (allowed.has("spending")) bundle.spending = await buildSpendingBreakdown(db, wallet);
  if (allowed.has("productPrice")) {
    const price = bundle.price || await buildReceiptPriceAnalysis(db, receiptId, wallet);
    const products = [...new Map((price?.items || []).flatMap((item) => item.canonicalProductId
      ? [[`${item.canonicalProductId}:${item.priceUnit}`, { id: item.canonicalProductId, unit: item.priceUnit }]]
      : [])).values()];
    bundle.productPrices = (await Promise.all(products.map(({ id, unit }) => buildProductPriceIntelligence(db, id, price?.currencyCode ?? null, unit)))).filter(
      (value): value is ProductPriceIntelligence => Boolean(value),
    );
  }
  return bundle;
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

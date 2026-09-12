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
}

export interface ReceiptItemIntelligence {
  id: string;
  itemName: string;
  canonicalProductId: string | null;
  canonicalKey: string | null;
  displayName: string | null;
  category: string;
  paidPrice: number | null;
  normalizationConfidence: number;
}

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
  items: Array<{
    canonicalProductId: string | null;
    itemName: string;
    paidPrice: number | null;
    marketAverage: number | null;
    priceScore: number | null;
    dealScore: number | null;
    sampleSize: number;
    confidence: number;
  }>;
}

export interface ProductPriceIntelligence {
  canonicalProductId: string;
  averagePrice: number;
  minPrice: number;
  maxPrice: number;
  priceMomentum30d: number;
  sampleSize: number;
  confidence: number;
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
            ri.paid_price, ri.normalization_confidence
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

async function priceAggregates(db: Db, productIds: string[]): Promise<Map<string, { average: number; sampleSize: number }>> {
  if (productIds.length === 0) return new Map();
  const result = await db.query(
    `SELECT ri.canonical_product_id,
            AVG(ri.paid_price) AS average_price,
            COUNT(*) AS sample_size
     FROM receipt_items ri
     WHERE ri.canonical_product_id = ANY($1::BIGINT[]) AND ri.paid_price IS NOT NULL
     GROUP BY ri.canonical_product_id`,
    [productIds],
  );
  return new Map(result.rows.map((row) => [String(row.canonical_product_id), {
    average: Number(row.average_price),
    sampleSize: Number(row.sample_size),
  }]));
}

export async function buildReceiptPriceAnalysis(db: Db, receiptId: string, wallet: string): Promise<ReceiptPriceAnalysis | null> {
  const receipt = await findReceipt(db, receiptId, wallet);
  if (!receipt) return null;
  const items = await receiptItems(db, receiptId);
  const aggregates = await priceAggregates(db, [...new Set(items.flatMap((item) => item.canonicalProductId ? [item.canonicalProductId] : []))]);
  return {
    receiptId,
    items: items.map((item) => {
      const aggregate = item.canonicalProductId ? aggregates.get(item.canonicalProductId) : undefined;
      if (item.paidPrice === null || !aggregate || aggregate.average <= 0) {
        return { canonicalProductId: item.canonicalProductId, itemName: item.itemName, paidPrice: item.paidPrice, marketAverage: aggregate?.average ?? null, priceScore: null, dealScore: null, sampleSize: aggregate?.sampleSize ?? 0, confidence: 0 };
      }
      const relativeDifference = (item.paidPrice - aggregate.average) / aggregate.average;
      return {
        canonicalProductId: item.canonicalProductId,
        itemName: item.itemName,
        paidPrice: round(item.paidPrice),
        marketAverage: round(aggregate.average),
        priceScore: Math.round(clamp(100 - Math.abs(relativeDifference) * 100)),
        dealScore: Math.round(clamp(100 - relativeDifference * 100)),
        sampleSize: aggregate.sampleSize,
        confidence: round(Math.min(1, (0.5 + aggregate.sampleSize / 500) * item.normalizationConfidence)),
      };
    }),
  };
}

export async function buildProductPriceIntelligence(db: Db, productId: string): Promise<ProductPriceIntelligence | null> {
  const result = await db.query(
    `SELECT AVG(ri.paid_price) AS average_price,
            MIN(ri.paid_price) AS min_price,
            MAX(ri.paid_price) AS max_price,
            COUNT(*) AS sample_size,
            AVG(ri.paid_price) FILTER (WHERE r.verified_at >= NOW() - INTERVAL '30 days') AS current_average,
            AVG(ri.paid_price) FILTER (WHERE r.verified_at >= NOW() - INTERVAL '60 days' AND r.verified_at < NOW() - INTERVAL '30 days') AS previous_average
     FROM receipt_items ri JOIN receipts r ON r.id = ri.receipt_id
     WHERE ri.canonical_product_id = $1 AND ri.paid_price IS NOT NULL`,
    [productId],
  );
  const row = result.rows[0];
  const sampleSize = Number(row?.sample_size || 0);
  if (!sampleSize) return null;
  const averagePrice = Number(row.average_price);
  const currentAverage = Number(row.current_average || averagePrice);
  const previousAverage = Number(row.previous_average || 0);
  return {
    canonicalProductId: productId,
    averagePrice: round(averagePrice),
    minPrice: round(Number(row.min_price)),
    maxPrice: round(Number(row.max_price)),
    priceMomentum30d: previousAverage > 0 ? round(currentAverage / previousAverage - 1, 4) : 0,
    sampleSize,
    confidence: round(Math.min(1, 0.5 + sampleSize / 500)),
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
     ORDER BY item_count DESC, item_name ASC LIMIT 10`,
    [wallet],
  );
  const categories = await db.query(
    `SELECT COALESCE(cp.category, 'unknown') AS category, COUNT(*) AS item_count
     FROM receipt_items ri
     JOIN receipts r ON r.id = ri.receipt_id
     JOIN users u ON u.id = r.user_id
     LEFT JOIN canonical_products cp ON cp.id = ri.canonical_product_id
     WHERE lower(u.wallet_address) = lower($1)
     GROUP BY COALESCE(cp.category, 'unknown')
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
  return {
    purchaseFrequency: Object.fromEntries(frequency.rows.map((row) => [row.item_name, Number(row.item_count)])),
    topCategories: categories.rows.map((row) => row.category),
    basketTrend: current > previous + 2 ? "improving" : current + 2 < previous ? "declining" : "stable",
    repeatPurchaseRatio: round(total ? repeated / total : 0, 4),
  };
}

export async function buildRecommendations(db: Db, receiptId: string, wallet: string): Promise<Recommendation[] | null> {
  const basket = await buildBasketIntelligence(db, receiptId, wallet);
  const prices = await buildReceiptPriceAnalysis(db, receiptId, wallet);
  if (!basket || !prices) return null;
  const recommendations: Recommendation[] = [];
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
  const allowed = new Set(include.length ? include : ["basket", "price", "recommendation"]);
  const bundle: BundleIntelligence = { receiptId };
  if (allowed.has("basket")) bundle.basket = (await buildBasketIntelligence(db, receiptId, wallet)) || undefined;
  if (allowed.has("price")) bundle.price = (await buildReceiptPriceAnalysis(db, receiptId, wallet)) || undefined;
  if (allowed.has("recommendation")) bundle.recommendations = (await buildRecommendations(db, receiptId, wallet)) || undefined;
  return bundle;
}

export function buildAdvancedFromFeatures(features: IntelligenceFeatureSet) {
  return buildIntelligenceReport(features);
}

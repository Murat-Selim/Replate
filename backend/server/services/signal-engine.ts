import type { PoolClient } from "pg";

type Db = Pick<PoolClient, "query">;

export const MIN_SIGNAL_SAMPLE_SIZE = 20;
export const SIGNAL_VERSION = "signals-v1";

export interface ProductSignal {
  canonicalProductId: string;
  priceScore: number;
  dealScore: number;
  demandScore: number;
  priceMomentum: number;
  sampleSize: number;
  confidence: number;
  signalVersion: string;
  calculationVersion: string;
}

export interface CategorySignal {
  category: string;
  priceMomentum30d: number;
  demandMomentum30d: number;
  observationCount: number;
  confidence: number;
  signalVersion: string;
  calculationVersion: string;
}

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value));
}

function round(value: number, decimals = 4): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function confidence(sampleSize: number): number {
  return round(Math.min(1, 0.5 + sampleSize / 500));
}

export async function buildProductSignal(db: Db, productId: string): Promise<ProductSignal | null> {
  const result = await db.query(
    `SELECT AVG(ri.paid_price) AS average_price,
            COUNT(*) AS sample_size,
            COUNT(*) FILTER (WHERE r.verified_at >= NOW() - INTERVAL '30 days') AS current_count,
            COUNT(*) FILTER (WHERE r.verified_at >= NOW() - INTERVAL '60 days' AND r.verified_at < NOW() - INTERVAL '30 days') AS previous_count,
            AVG(ri.paid_price) FILTER (WHERE r.verified_at >= NOW() - INTERVAL '30 days') AS current_average,
            AVG(ri.paid_price) FILTER (WHERE r.verified_at >= NOW() - INTERVAL '60 days' AND r.verified_at < NOW() - INTERVAL '30 days') AS previous_average
     FROM receipt_items ri JOIN receipts r ON r.id = ri.receipt_id
     WHERE ri.canonical_product_id = $1 AND ri.paid_price IS NOT NULL`,
    [productId],
  );
  const row = result.rows[0];
  const sampleSize = Number(row?.sample_size || 0);
  if (!sampleSize) return null;
  const average = Number(row.average_price);
  const currentAverage = Number(row.current_average || average);
  const previousAverage = Number(row.previous_average || 0);
  const priceMomentum = previousAverage > 0 ? currentAverage / previousAverage - 1 : 0;
  const relativeCurrent = average > 0 ? (currentAverage - average) / average : 0;
  const currentCount = Number(row.current_count || 0);
  const previousCount = Number(row.previous_count || 0);
  const demandMomentum = previousCount > 0 ? currentCount / previousCount - 1 : 0;
  return {
    canonicalProductId: productId,
    priceScore: Math.round(clamp(75 - relativeCurrent * 300)),
    dealScore: Math.round(clamp(100 - Math.max(0, relativeCurrent) * 400)),
    demandScore: Math.round(clamp(50 + demandMomentum * 100)),
    priceMomentum: round(priceMomentum),
    sampleSize,
    confidence: confidence(sampleSize),
    signalVersion: SIGNAL_VERSION,
    calculationVersion: SIGNAL_VERSION,
  };
}

export async function buildCategorySignal(db: Db, category: string): Promise<CategorySignal | null> {
  const result = await db.query(
    `SELECT COUNT(*) AS observation_count,
            COUNT(*) FILTER (WHERE r.verified_at >= NOW() - INTERVAL '30 days') AS current_count,
            COUNT(*) FILTER (WHERE r.verified_at >= NOW() - INTERVAL '60 days' AND r.verified_at < NOW() - INTERVAL '30 days') AS previous_count,
            AVG(ri.paid_price) FILTER (WHERE r.verified_at >= NOW() - INTERVAL '30 days') AS current_average,
            AVG(ri.paid_price) FILTER (WHERE r.verified_at >= NOW() - INTERVAL '60 days' AND r.verified_at < NOW() - INTERVAL '30 days') AS previous_average
     FROM receipt_items ri
     JOIN receipts r ON r.id = ri.receipt_id
     JOIN canonical_products cp ON cp.id = ri.canonical_product_id
     WHERE lower(cp.category) = lower($1) AND ri.paid_price IS NOT NULL`,
    [category],
  );
  const row = result.rows[0];
  const observationCount = Number(row?.observation_count || 0);
  if (!observationCount) return null;
  const currentAverage = Number(row.current_average || 0);
  const previousAverage = Number(row.previous_average || 0);
  const currentCount = Number(row.current_count || 0);
  const previousCount = Number(row.previous_count || 0);
  return {
    category,
    priceMomentum30d: previousAverage > 0 ? round(currentAverage / previousAverage - 1) : 0,
    demandMomentum30d: previousCount > 0 ? round(currentCount / previousCount - 1) : 0,
    observationCount,
    confidence: confidence(observationCount),
    signalVersion: SIGNAL_VERSION,
    calculationVersion: SIGNAL_VERSION,
  };
}

export async function saveProductSignal(db: Db, signal: ProductSignal): Promise<string> {
  const result = await db.query<{ id: string }>(
    `INSERT INTO signals
       (signal_type, canonical_product_id, score, value, confidence, sample_size, period_start, period_end, signal_version, calculation_version)
     VALUES ('product_signal', $1, $2, $3, $4, $5, NOW() - INTERVAL '30 days', NOW(), $6, $6)
     RETURNING id`,
    [signal.canonicalProductId, signal.priceScore, signal.priceMomentum, signal.confidence, signal.sampleSize, SIGNAL_VERSION],
  );
  return String(result.rows[0].id);
}

export async function saveCategorySignal(db: Db, signal: CategorySignal): Promise<string> {
  const result = await db.query<{ id: string }>(
    `INSERT INTO signals
       (signal_type, category, score, value, confidence, sample_size, period_start, period_end, signal_version, calculation_version)
     VALUES ('category_signal', $1, $2, $3, $4, $5, NOW() - INTERVAL '30 days', NOW(), $6, $6)
     RETURNING id`,
    [signal.category, 100 - Math.abs(signal.priceMomentum30d * 100), signal.priceMomentum30d, signal.confidence, signal.observationCount, SIGNAL_VERSION],
  );
  return String(result.rows[0].id);
}

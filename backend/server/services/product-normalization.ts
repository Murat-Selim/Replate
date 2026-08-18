import { CATALOG_BY_ID, SORTED_ALIAS_ENTRIES } from "./product-catalog.js";
import { normalizeTurkish } from "./classifier.js";

export interface NormalizedProduct {
  canonicalKey: string | null;
  category: "healthy" | "unhealthy" | "neutral" | "excluded";
  confidence: number;
}

export function normalizeProduct(name: string, category: NormalizedProduct["category"]): NormalizedProduct {
  if (category === "excluded") return { canonicalKey: null, category, confidence: 1 };
  const normalized = normalizeTurkish(name.trim());
  const match = SORTED_ALIAS_ENTRIES.find(([alias]) => normalized.includes(normalizeTurkish(alias)));
  const entry = match ? CATALOG_BY_ID.get(match[1]) : undefined;
  if (!entry || entry.category !== category) return { canonicalKey: null, category, confidence: 0.35 };
  return { canonicalKey: entry.id, category, confidence: 0.95 };
}

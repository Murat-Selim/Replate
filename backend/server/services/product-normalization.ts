import { CATALOG_BY_ID, SORTED_ALIAS_ENTRIES } from "./product-catalog.js";
import { normalizeTurkish } from "./classifier.js";

export interface NormalizedProduct {
  canonicalKey: string | null;
  category: "healthy" | "unhealthy" | "neutral" | "excluded";
  confidence: number;
}

export function normalizeProduct(name: string, category: NormalizedProduct["category"]): NormalizedProduct {
  const normalized = normalizeTurkish(name.trim());
  // ponytail: exact normalized fallback will split wording variants; reviewed aliases when duplicate reports justify it.
  const fallbackKey = `item:${normalized.replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;
  if (category === "excluded") return { canonicalKey: fallbackKey === "item:" ? null : fallbackKey, category, confidence: 0.5 };
  const match = SORTED_ALIAS_ENTRIES.find(([alias]) => normalized.includes(normalizeTurkish(alias)));
  const entry = match ? CATALOG_BY_ID.get(match[1]) : undefined;
  if (!entry || entry.category !== category) return { canonicalKey: fallbackKey === "item:" ? null : fallbackKey, category, confidence: 0.45 };
  return { canonicalKey: entry.id, category, confidence: 0.95 };
}

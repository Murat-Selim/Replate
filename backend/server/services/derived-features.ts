import { VerifiedReceipt } from "./verified-receipt.js";

interface ProductForFeatures {
  category: "healthy" | "unhealthy" | "neutral" | "excluded";
  fruitVegGrams: number;
  confidence: number;
}

const PROTEIN_KEYS = new Set(["tavuk", "balik", "ton", "somon", "levrek", "cipura", "hamsi", "sardalya", "dana", "kuzu", "yumurta", "mercimek", "nohut", "fasulye"]);

export interface DerivedFeature {
  name: string;
  value: number;
  confidence: number;
  metadata: Record<string, string>;
}

export function buildDerivedFeatures(
  receipt: VerifiedReceipt,
  products: ProductForFeatures[],
  canonicalKeys: Array<string | null>,
): DerivedFeature[] {
  const scoreable = products.filter((product) => product.category !== "excluded");
  const total = receipt.totalItems || 1;
  const confidence = products.length === 0 ? 0 : products.reduce((sum, product) => sum + product.confidence, 0) / products.length;
  const healthy = scoreable.filter((product) => product.category === "healthy").length;
  const unhealthy = scoreable.filter((product) => product.category === "unhealthy").length;
  const neutral = scoreable.filter((product) => product.category === "neutral").length;
  const expectedFruitVeg = receipt.householdSize * receipt.daysCovered * 300;
  const uniqueCanonical = new Set(canonicalKeys.filter((key): key is string => !!key)).size;
  const protein = canonicalKeys.filter((key, index) => key && products[index]?.category !== "excluded" && PROTEIN_KEYS.has(key)).length;
  const metadata = { source: "verified-receipt", calculationVersion: "features-v1" };

  return [
    ["healthy_item_ratio", healthy / total],
    ["unhealthy_item_ratio", unhealthy / total],
    ["neutral_item_ratio", neutral / total],
    ["fruit_veg_ratio", Math.min(1, receipt.fruitVegGrams / expectedFruitVeg)],
    // ponytail: classifier has no separate processed flag; unhealthy ratio is the v1 proxy.
    ["processed_food_ratio", unhealthy / total],
    ["protein_ratio", protein / total],
    ["basket_diversity", uniqueCanonical / total],
    ["estimated_household_coverage", Math.min(1, receipt.fruitVegGrams / expectedFruitVeg)],
    ["health_score", receipt.healthScore],
    ["nutrition_score", receipt.nutritionScore],
    ["total_item_count", receipt.totalItems],
  ].map(([name, value]) => ({ name: name as string, value: value as number, confidence, metadata }));
}

import { normalizeProductText, type ClassificationResult, type FoodClassification } from "./classifier.js";
import { getSpendingCategory, SPENDING_CATEGORIES, type SpendingCategory } from "./spending-categories.js";

interface ModelLabel {
  spendingCategory: SpendingCategory;
  health: "healthy" | "unhealthy" | "neutral";
  fruitVeg: boolean;
}

/** Labels survive across requests: the same product name always gets the same answer. */
const labelCache = new Map<string, ModelLabel>();
/** Default portion when a fruit or vegetable has no printed weight, matching the catalog's typical piece. */
const DEFAULT_FRUIT_VEG_GRAMS = 150;

function needsLabel(product: ClassificationResult): boolean {
  return product.category !== "excluded" && !product.spendingCategory
    && getSpendingCategory(product.name) === "other";
}

async function requestLabels(names: string[]): Promise<Map<string, ModelLabel>> {
  const apiKey = process.env.OCR_API_KEY?.trim();
  const labels = new Map<string, ModelLabel>();
  if (!apiKey || !names.length) return labels;
  const response = await fetch("https://api.doubleword.ai/v1/chat/completions", {
    method: "POST",
    redirect: "error",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    signal: AbortSignal.timeout(15000),
    body: JSON.stringify({
      model: "Qwen/Qwen3.6-35B-A3B-FP8", reasoning_effort: "none", temperature: 0, max_tokens: 60 * names.length + 100,
      stream: false, service_tier: "priority",
      messages: [{ role: "user", content: [
        "Classify each grocery receipt item. Names may be abbreviated and in any language.",
        `category: one of ${SPENDING_CATEGORIES.join(", ")} (household = non-food; other = cannot tell).`,
        "health: healthy (fresh produce, plain dairy, eggs, fresh meat/fish, legumes, whole grains, water, olive oil), unhealthy (sugary, sweets, snacks, sugary drinks, alcohol, processed meat), otherwise neutral.",
        "fruitVeg: true only for fresh fruits and vegetables.",
        'Reply with only JSON: {"items":[{"i":0,"category":"produce","health":"healthy","fruitVeg":true}]}',
        ...names.map((name, index) => `${index}: ${name}`),
      ].join("\n") }],
    }),
  });
  if (!response.ok) return labels;
  const data = await response.json() as { choices?: Array<{ finish_reason?: string; message?: { content?: string } }> };
  if (data.choices?.[0]?.finish_reason !== "stop") return labels;
  const json = data.choices[0].message?.content?.match(/\{[\s\S]*\}/)?.[0];
  if (!json) return labels;
  const items = (JSON.parse(json) as { items?: unknown }).items;
  if (!Array.isArray(items)) return labels;
  for (const item of items as Array<Record<string, unknown>>) {
    const index = item.i;
    const category = item.category as SpendingCategory;
    const health = item.health as ModelLabel["health"];
    // Ignore anything outside the fixed vocabulary instead of trusting free-form model text.
    if (typeof index !== "number" || !Number.isInteger(index) || index < 0 || index >= names.length) continue;
    if (!SPENDING_CATEGORIES.includes(category) || category === "other") continue;
    if (!["healthy", "unhealthy", "neutral"].includes(health) || typeof item.fruitVeg !== "boolean") continue;
    labels.set(names[index], { spendingCategory: category, health, fruitVeg: item.fruitVeg && category === "produce" });
  }
  return labels;
}

/**
 * Label products the local catalog cannot place (e.g. foreign-language receipts) with one text-only model call.
 * Failures leave products unlabelled, so the receipt is rejected exactly as before rather than guessed.
 */
export async function labelUnknownProducts(classification: FoodClassification): Promise<FoodClassification> {
  const unknown = classification.products.filter(needsLabel);
  if (!unknown.length) return classification;
  const keyOf = (name: string) => normalizeProductText(name).replace(/\s+/g, " ").trim();
  const missing = [...new Set(unknown.map((product) => keyOf(product.name)).filter((key) => !labelCache.has(key)))];
  if (missing.length && missing.length <= 100) {
    try {
      const fresh = await requestLabels(missing);
      for (const [key, label] of fresh) labelCache.set(key, label);
    } catch {
      // A failed lookup keeps the products unlabelled.
    }
  }
  const products = classification.products.map((product) => {
    const label = needsLabel(product) ? labelCache.get(keyOf(product.name)) : undefined;
    if (!label) return product;
    // Catalog decisions stay authoritative; the model only fills in what the catalog could not decide.
    const fromCatalog = product.confidence > 0.35;
    const category = fromCatalog ? product.category : label.health;
    const fruitVegGrams = product.fruitVegGrams || (label.fruitVeg && category !== "unhealthy"
      ? product.actualWeightGrams > 0 ? product.actualWeightGrams : DEFAULT_FRUIT_VEG_GRAMS * Math.max(1, product.quantity)
      : 0);
    return { ...product, category, fruitVegGrams, spendingCategory: label.spendingCategory, confidence: fromCatalog ? product.confidence : 0.6 };
  });
  const scored = products.filter((product) => product.category !== "excluded");
  return {
    ...classification,
    products,
    healthyItems: scored.filter((product) => product.category === "healthy").length,
    unhealthyItems: scored.filter((product) => product.category === "unhealthy").length,
    fruitVegGrams: scored.reduce((sum, product) => sum + product.fruitVegGrams, 0),
  };
}

/** The product's spending category: a stored model label first, then the keyword rules. */
export function productSpendingCategory(product: { name: string; category: string; spendingCategory?: string }): SpendingCategory {
  const stored = product.spendingCategory as SpendingCategory | undefined;
  if (stored && SPENDING_CATEGORIES.includes(stored) && stored !== "other") return stored;
  return getSpendingCategory(product.name, product.category === "excluded");
}

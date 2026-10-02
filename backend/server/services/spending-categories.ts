import { normalizeTurkish } from "./classifier.js";

export const SPENDING_CATEGORIES = ["meat", "snacks", "dairy", "drinks", "produce", "bakery", "frozen", "pantry", "household", "other"] as const;
export type SpendingCategory = typeof SPENDING_CATEGORIES[number];

const RULES: Array<[SpendingCategory, string[]]> = [
  ["household", ["detergent", "deterjan", "soap", "sabon", "shampoo", "sampuan", "toilet paper", "paper towel", "shopping bag", "poset", "pecete", "hijyen", "diaper", "ampul", "battery"]],
  ["frozen", ["frozen", "donuk", "dondurulmus", "dondurma"]],
  ["meat", ["chicken", "tavuk", "beef", "dana", "meat", "kuzu", "lamb", "fish", "balik", "salmon", "sucuk", "salam", "sosis", "pastirma"]],
  ["dairy", ["milk", "sut", "yogurt", "cheese", "peynir", "butter", "tereyag", "cream", "kaymak", "egg", "yumurta"]],
  ["snacks", ["snack", "cips", "chips", "biskuvi", "gofret", "cikolata", "chocolate", "cookie", "candy", "cracker", "gofret", "sekerleme"]],
  ["drinks", ["drink", "beverage", "icecek", "water", "su", "cola", "soda", "juice", "meyve suyu", "tea", "cay", "coffee", "kahve", "limonata"]],
  ["produce", ["fruit", "vegetable", "meyve", "sebze", "elma", "apple", "muz", "banana", "domates", "tomato", "patates", "potato", "salatalik", "carrot", "broccoli"]],
  ["bakery", ["bread", "ekmek", "bakery", "croissant", "pogaca", "simit", "borek"]],
  ["pantry", ["rice", "pirinc", "pasta", "makarna", "flour", "un", "oil", "yag", "beans", "fasulye", "lentil", "mercimek", "canned", "konserve"]],
];

// ponytail: keyword matching misses novel labels; add reviewed aliases when receipt corrections expose repeat errors.
export function getSpendingCategory(name: string, isExcluded = false): SpendingCategory {
  const normalized = normalizeTurkish(name).replace(/[^a-z0-9]+/g, " ").trim();
  for (const [category, keywords] of RULES) {
    if (keywords.some((keyword) => keyword.length < 3
      ? normalized.split(" ").includes(keyword)
      : normalized.includes(keyword))) return category;
  }
  return isExcluded ? "household" : "other";
}

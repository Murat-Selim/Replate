import { normalizeTurkish } from "./classifier.js";
import { FRUIT_VEG_KEYWORDS } from "./product-catalog.js";

export const SPENDING_CATEGORIES = ["meat", "snacks", "dairy", "drinks", "produce", "bakery", "frozen", "pantry", "household", "other"] as const;
export type SpendingCategory = typeof SPENDING_CATEGORIES[number];

const RULES: Array<[SpendingCategory, string[]]> = [
  ["household", ["detergent", "deterjan", "soap", "sabon", "shampoo", "sampuan", "toilet paper", "paper towel", "shopping bag", "poset", "pecete", "hijyen", "diaper", "ampul", "battery", "temizlik", "cleaning wipe", "wet wipe", "bulasik", "bul sun", "sunger", "ovma teli"]],
  ["frozen", ["frozen", "donuk", "dondurulmus", "dondurma", "dond"]],
  ["meat", ["chicken", "tavuk", "beef", "dana", "meat", "kuzu", "lamb", "fish", "balik", "salmon", "sucuk", "salam", "sosis", "pastirma"]],
  ["dairy", ["milk", "sut", "yogurt", "cheese", "peynir", "butter", "tereyag", "cream", "kaymak", "egg", "yumurta"]],
  ["snacks", ["snack", "cips", "chips", "biskuvi", "gofret", "cikolata", "chocolate", "cookie", "candy", "cracker", "gofret", "sekerleme", "kek", "kakao"]],
  ["drinks", ["drink", "beverage", "icecek", "water", "su", "cola", "soda", "juice", "meyve suyu", "maden suyu", "tea", "cay", "coffee", "kahve", "limonata"]],
  ["pantry", ["rice", "pirinc", "pasta", "makarna", "flour", "un", "oil", "yag", "beans", "fasulye", "lentil", "mercimek", "canned", "konserve", "seker", "recel", "jam", "salca", "rendesi"]],
  ["produce", ["fruit", "vegetable", "meyve", "sebze", "apple", "banana", "tomato", "potato", "carrot", "broccoli", "orange", "plum", ...Object.keys(FRUIT_VEG_KEYWORDS)]],
  ["bakery", ["bread", "ekmek", "bakery", "croissant", "pogaca", "simit", "borek", "kanepe burger", "lavas"]],
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

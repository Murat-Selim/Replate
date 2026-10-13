/** Shared product types and text folding; receipts are read by the schema reader in receipt-reader.ts. */

/**
 * Fold Turkish diacritics so OCR variants (ŞEKER / seker / Şeker) match the same keywords.
 */
export function normalizeTurkish(text: string): string {
  return text
    .replace(/İ/g, "i")
    .replace(/I/g, "i")
    .replace(/ı/g, "i")
    .replace(/Ş/g, "s")
    .replace(/ş/g, "s")
    .replace(/Ğ/g, "g")
    .replace(/ğ/g, "g")
    .replace(/Ü/g, "u")
    .replace(/ü/g, "u")
    .replace(/Ö/g, "o")
    .replace(/ö/g, "o")
    .replace(/Ç/g, "c")
    .replace(/ç/g, "c")
    .toLowerCase();
}

/** Correct reviewed OCR product tokens without changing raw receipt text or amounts. */
export function normalizeProductText(text: string): string {
  return normalizeTurkish(text)
    .replace(/\bb[il1]skuv[il1](?:s[il1])?\b/g, "biskuvi")
    .replace(/\b[nmh]aden(?=\s+suyu\b)/g, "maden")
    .replace(/\b[il1]cecek\b/g, "icecek")
    .replace(/\b(meyve[il1]{1,2}|aromal[il1])\s*\(?\s*(?:i)?cecek\b/g, (_match, flavor: string) => `${flavor.startsWith("meyve") ? "meyveli" : "aromali"} icecek`);
}

export interface ClassificationResult {
  name: string;
  category: "healthy" | "unhealthy" | "neutral" | "excluded";
  nutriscore?: string;
  paidPrice?: number;
  quantity: number;
  actualWeightGrams: number;
  fruitVegGrams: number;
  confidence: number;
  /** Spending category chosen by the receipt reader. */
  spendingCategory?: string;
}

export interface FoodClassification {
  totalItems: number;
  detectedItems: number;
  excludedItems: number;
  healthyItems: number;
  unhealthyItems: number;
  fruitVegGrams: number;
  products: ClassificationResult[];
}

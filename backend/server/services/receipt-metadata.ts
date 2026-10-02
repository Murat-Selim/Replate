import { parseReceiptAmount, type ClassificationResult } from "./classifier.js";

export type ReceiptTotalSource = "receipt_total" | "line_items" | null;

export interface ReceiptMetadata {
  storeName: string | null;
  currencyCode: string | null;
  totalSpent: number | null;
  totalSpentSource: ReceiptTotalSource;
}

export function extractReceiptMetadata(lines: string[], products: ClassificationResult[]): ReceiptMetadata {
  const header = lines.slice(0, 10);
  const joined = lines.join(" ").toUpperCase();
  const currencyCode = /\bS\$|\bSGD\b/.test(joined) ? "SGD"
    : /\bTRY\b|\bTL\b|₺/.test(joined) ? "TRY"
      : /\bEUR\b|€/.test(joined) ? "EUR"
        : /\bGBP\b|£/.test(joined) ? "GBP"
          : /\bUSD\b|US\$|\$/.test(joined) ? "USD"
            : /\bJPY\b|¥/.test(joined) ? "JPY"
              : null;

  const normalizedHeader = header.map((line) => line.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase());
  const storeAliases: Array<[string, RegExp]> = [
    ["Migros", /\bmigros\b/], ["BİM", /\bbim\b/], ["A101", /\ba\s*101\b/], ["ŞOK", /\bsok\b/],
    ["CarrefourSA", /\bcarrefour/], ["Macrocenter", /\bmacrocenter\b/], ["Walmart", /\bwalmart\b/],
    ["Target", /\btarget\b/], ["Costco", /\bcostco\b/],
  ];
  const storeName = storeAliases.find(([, pattern]) => normalizedHeader.some((line) => pattern.test(line)))?.[0]
    || header.find((line) => line.length >= 2 && line.length <= 80 && /[A-Za-zÇĞİÖŞÜçğıöşü]/.test(line)
      && !/\b(?:vkn|mersis|adres|address|tarih|date|fis no|fiş no|receipt|kasiyer|cashier|terminal|tel:|www\.)\b/i.test(line))?.trim()
    || null;

  const totalLine = lines.find((line) => /^\s*(?:GRAND\s+TOTAL|TOTAL(?:\s+DUE)?|GENEL\s+TOPLAM|TOPLAM)(?!\s+(?:KDV|TAX|INDIRIM|DISCOUNT))\b/i.test(line));
  const printedTotal = totalLine ? parseReceiptAmount(totalLine) : undefined;
  const itemizedTotal = products.reduce((sum, product) => sum + (product.paidPrice ?? 0), 0);
  const hasItemPrices = products.some((product) => product.paidPrice !== undefined);

  return {
    storeName,
    currencyCode,
    totalSpent: printedTotal ?? (hasItemPrices ? Number(itemizedTotal.toFixed(2)) : null),
    totalSpentSource: printedTotal !== undefined ? "receipt_total" : hasItemPrices ? "line_items" : null,
  };
}

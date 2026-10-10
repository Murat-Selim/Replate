import { normalizeTurkish, parseReceiptAmount, type ClassificationResult } from "./classifier.js";

export type ReceiptTotalSource = "receipt_total" | "line_items" | null;

export interface ReceiptMetadata {
  storeName: string | null;
  currencyCode: string | null;
  totalSpent: number | null;
  totalSpentSource: ReceiptTotalSource;
  /** Printed subtotal, only when separately printed tax reconciles it to the final total. */
  expectedItemsTotal?: number | null;
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
              // Turkish fiscal receipts often print bare "*50,00"; their tax labels still identify TRY.
              : /\b(?:KDV|TOPKDV|VKN|MERSIS|ODENECEK TUTAR|FIS NO)\b/i.test(normalizeTurkish(joined)) ? "TRY"
                : null;

  const normalizedHeader = header.map((line) => line.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase())
    // Street lines ("Mimar Sinan Sok. No:3") must not name the store \u015eOK.
    .filter((line) => !/\b(?:adres|address|mah|mh|cad|cd|sok\s*\.|sokak|sk\s*\.)/.test(line));
  const storeAliases: Array<[string, RegExp]> = [
    ["Migros", /\bmigros\b/], ["BİM", /\bbim\b/], ["A101", /\ba\s*101\b/], ["ŞOK", /\bsok\b(?!\s*\.)/],
    ["CarrefourSA", /\bcarrefour/], ["Macrocenter", /\bmacrocenter\b/], ["Walmart", /\bwalmart\b/],
    ["Target", /\btarget\b/], ["Costco", /\bcostco\b/],
  ];
  const storeName = storeAliases.find(([, pattern]) => normalizedHeader.some((line) => pattern.test(line)))?.[0]
    || header.find((line) => line.length >= 2 && line.length <= 80 && /[A-Za-zÇĞİÖŞÜçğıöşü]/.test(line)
      && !/\b(?:vkn|mersis|adres|address|tarih|date|fis no|fiş no|receipt|kasiyer|cashier|terminal|tel:|www\.|toplam|total|kdv)\b/i.test(line)
      && parseReceiptAmount(line) === undefined)?.trim()
    || null;

  const totalPatterns = [
    /^(?:ODENECEK\s+TUTAR|PAYABLE\s+AMOUNT)\b/,
    /^(?:GRAND\s+TOTAL|TOTAL(?:\s+DUE)?|GENEL\s+TOPLAM|TOPLAM)(?!\s+(?:KDV|TAX|INDIRIM|DISCOUNT))\b/,
  ];
  let printedTotal: number | undefined;
  for (const pattern of totalPatterns) {
    for (let index = 0; index < lines.length; index++) {
      const normalized = lines[index].normalize("NFKD").replace(/[\u0300-\u036f]/g, "").trim().toUpperCase();
      if (!pattern.test(normalized)) continue;
      const nextLine = lines[index + 1]?.trim() ?? "";
      const previousLine = lines[index - 1]?.trim() ?? "";
      const standaloneAmount = /^(?:S\$|[$€£¥])?\s*\*?\s*[\d.,\s]+$/;
      printedTotal = parseReceiptAmount(lines[index])
        ?? (standaloneAmount.test(nextLine) ? parseReceiptAmount(nextLine) : undefined)
        ?? (standaloneAmount.test(previousLine) ? parseReceiptAmount(previousLine) : undefined);
      if (printedTotal !== undefined) break;
    }
    if (printedTotal !== undefined) break;
  }
  const itemizedTotal = products.reduce((sum, product) => sum + (product.paidPrice ?? 0), 0);
  const hasItemPrices = products.some((product) => product.paidPrice !== undefined);

  let printedSubtotal: number | undefined;
  let addedTax = 0;
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index].trim().toUpperCase();
    const subtotal = /^SUB\s*TOTAL\b/.test(line);
    const tax = /^(?:(?:SALES\s+)?TAX|GST|HST|PST)\b/.test(line) && !/\bINCL(?:UDED|USIVE)?\b/.test(line);
    if (!subtotal && !tax) continue;
    const next = lines[index + 1]?.trim() ?? "";
    const value = parseReceiptAmount(line) ?? (/^(?:[$€£¥])?\s*[\d.,]+$/.test(next) ? parseReceiptAmount(next) : undefined);
    if (value === undefined) continue;
    if (subtotal) printedSubtotal = value;
    else addedTax += value;
  }
  const expectedItemsTotal = printedTotal !== undefined && printedSubtotal !== undefined && addedTax > 0
    && Math.abs(Math.round((printedSubtotal + addedTax) * 100) - Math.round(printedTotal * 100)) <= 1
    ? printedSubtotal : null;

  return {
    storeName,
    currencyCode,
    totalSpent: printedTotal ?? (hasItemPrices ? Number(itemizedTotal.toFixed(2)) : null),
    totalSpentSource: printedTotal !== undefined ? "receipt_total" : hasItemPrices ? "line_items" : null,
    expectedItemsTotal,
  };
}

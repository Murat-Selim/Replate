import axios from "axios";
import {
  FRUIT_VEG_KEYWORDS,
  HEALTHY_KEYWORDS,
  HEALTHY_PROCESSED_KEYWORDS,
  NEUTRAL_KEYWORDS,
  PROCESSED_OR_COMPOSITE_KEYWORDS,
  SORTED_ALIAS_ENTRIES,
  STRIP_NAME_TOKENS,
  UNHEALTHY_KEYWORDS,
} from "./product-catalog.js";

const OFF_SEARCH = "https://world.openfoodfacts.org/api/v2/search";

// Only create cache when OFF API is enabled
const offCache =
  process.env.USE_OFF_API === "true"
    ? new Map<string, ClassificationResult | null>()
    : null;

// Debug logging — suppressed in production
const DEBUG = process.env.NODE_ENV !== "production";
function debugLog(...args: unknown[]) {
  if (DEBUG) console.log(...args);
}

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

const matchKeyword = (text: string, keyword: string): boolean => {
  const normText = normalizeTurkish(text);
  const normKw = normalizeTurkish(keyword);
  // Short keywords (su, nar, ton, cay, lor…) need word boundaries
  if (normKw.length <= 3) {
    const escaped = normKw.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
    const regex = new RegExp(`(?:^|[^a-z0-9])${escaped}(?:$|[^a-z0-9])`, "i");
    return regex.test(normText);
  }
  return normText.includes(normKw);
};

export interface ClassificationResult {
  name: string;
  category: "healthy" | "unhealthy" | "neutral";
  nutriscore?: string;
  fruitVegGrams: number;
  confidence: number;
}

interface ExtractedProduct {
  name: string;
  actualWeightGrams: number; // 0 = use estimate
  /** Piece count when sold by adet (default 1) */
  quantity: number;
}

export interface FoodClassification {
  totalItems: number;
  healthyItems: number;
  unhealthyItems: number;
  fruitVegGrams: number;
  products: ClassificationResult[];
}

// Fruit/veg keyword set for processed restriction (normalized ids)
const FRUIT_VEG_IDS = new Set(
  Object.keys(FRUIT_VEG_KEYWORDS).map((k) => normalizeTurkish(k))
);

// Precompiled strip-token regex (brands, cultivars, packaging)
const STRIP_TOKEN_REGEX = new RegExp(
  `\\b(${STRIP_NAME_TOKENS.map((t) =>
    t.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&")
  ).join("|")})\\b`,
  "gi"
);

// ─── Receipt meta lines to skip ───────────────────────────────────────
// Prefer structural/meta terms over city/brand-specific tokens.
const SKIP_PATTERNS = [
  /^(TOTAL|SUBTOTAL|TAX|DATE|STORE|CASHIER|CHANGE|RECEIPT)/i,
  /^(TOPLAM|KDV|FIS|FİŞ|SAAT|TARIH|ARA TOPLAM|ALISVERIS|ALIŞVERİŞ|NAKIT|BANKA)/i,
  /^(BELGE|ETTN|FISC|KASA|DARA|ADET|ISKONTO|İSKONTO|INDIRIM|İNDİRİM)/i,
  /^\d{2}[./-]\d{2}[./-]\d{2,4}/, // dates
  /^[\d\/\-:,x\s]+$/, // pure numbers / weight lines
  /^[*\-=]+$/, // separator lines
  /^ALI[SŞ]VERI[SŞ]\s*PO[SŞ]ET/i, // bags
  /\bPO[SŞ]ET\b$/i,
  /^TEL:|^FAX:/i,
  /THANK|TE[SŞ]EKK[UÜ]R/i,
  /\b(MERSIS|VKN|VERG[İI]|DAIRE|DAİRE|SICIL|SİCİL|ADRES|FATURA)\b/i,
  /\b(E-?AR[SŞ][Iİ]V|EARSIV|EARŞİV|GIB|GİB)\b/i,
  /\b(KAS[Iİ]YER|KASAYER|TERMINAL|N[UÜ]SHA)\b/i,
  /\b([İI][SŞ]LEM|M[UÜ][SŞ]TER[Iİ]|BANKA|KRED[Iİ]|KREDL|KART|KARTI)\b/i,
  /\b(PUAN|BAK[Iİ]YE|PROV[Iİ]ZYON|MATRAH|[İI]ADE|[OÖ]DEME)\b/i,
  /\b(BEKLER[Iİ]Z|[İI]LET[Iİ][SŞ][Iİ]M|YINE BEKLERIZ)\b/i,
  /\b(WEB|E-?POSTA|[İI][SŞ]YER[Iİ]|UNVAN|TABELA|HO[SŞ]GELD[Iİ]N[Iİ]Z)\b/i,
  /\b(F[Iİ]YAT|F[Iİ]YATI|TUTAR|TUTARI|KDV'?S[Iİ]Z|KDV'?L[Iİ])\b/i,
  /\b(MAH(?:ALLESI?)?|MH|SOK(?:AK|A[GĞ]I)?|CAD(?:DES[Iİ])?)\b/i,
  /\b(ANON[Iİ]M|[SŞ][Iİ]RKET[Iİ]|LTD|[SŞ]T[Iİ]|A\.?[SŞ]\.?)\b/i,
  /\b(ARA TOPLAM|ARA TOPLAN|TOPLAM|PARA USTU|PARA ÜSTÜ)\b/i,
  /\b(YAPI KRED[Iİ]|YAPI KREDL)\b/i,
];

// ─── Non-food products found on grocery receipts ──────────────────────
const NON_FOOD_PATTERNS = [
  /\b(PED|H[Iİ]JYEN|PE[CÇ]ETE|HAVLU|KA[GĞ]IT|MEND[Iİ]L|DETERJAN|SABUN|[SŞ]AMPUAN|DURULAY|YUMU[SŞ]ATICI|[CÇ]AMA[SŞ]IR|BULA[SŞ]IK)\b/i,
  /\b(MOLPED|HOLPED|ORK[Iİ]D|KOTEX|ALWAYS|PR[Iİ]MA|PAMPERS|HUGGIES)\b/i,
  /\b([CÇ][OÖ]P\s*PO[SŞ]ET|TORBA|FIRIN TORBASI)\b/i,
  /\b(AMPUL|P[Iİ]L|BATARYA|LAMBA|DEODORANT|KREM|LOSYON|TIRNAK|D[Iİ][SŞ]\s*FIR[CÇ]ASI|D[Iİ][SŞ]\s*MACUNU|DIPMACUNU|TRA[SŞ])\b/i,
];

/**
 * Classify food items from receipt lines.
 */
export async function classifyFoods(
  lines: string[]
): Promise<FoodClassification> {
  const productLines = extractProductLines(lines);
  debugLog(
    `🔍 Extracted ${productLines.length} product lines:`,
    productLines.map(
      (p) =>
        `${p.name}${p.actualWeightGrams ? ` (${p.actualWeightGrams}g)` : ""}`
    )
  );

  // Parallel classification (helps when USE_OFF_API=true)
  const products = await Promise.all(
    productLines.map((item) =>
      classifyProduct(item.name, item.actualWeightGrams, item.quantity)
    )
  );

  let healthyItems = 0;
  let unhealthyItems = 0;
  let fruitVegGrams = 0;

  for (let i = 0; i < products.length; i++) {
    const classification = products[i];
    const item = productLines[i];
    debugLog(
      `   → "${item.name}" => ${classification.category} (${classification.fruitVegGrams}g fruit/veg` +
        `${item.actualWeightGrams ? ", actual weight" : ", estimated"}` +
        `${item.quantity > 1 ? `, qty ${item.quantity}` : ""})`
    );

    if (classification.category === "healthy") healthyItems++;
    else if (classification.category === "unhealthy") unhealthyItems++;
    fruitVegGrams += classification.fruitVegGrams;
  }

  debugLog(
    `📊 Final: ${productLines.length} total, ${healthyItems} healthy, ${unhealthyItems} unhealthy, ${fruitVegGrams}g fruit/veg`
  );

  return {
    totalItems: productLines.length,
    healthyItems,
    unhealthyItems,
    fruitVegGrams,
    products,
  };
}

/**
 * Extract product lines from receipt text.
 *
 * Phase 1: skip meta (totals, address, payment).
 * Phase 2: keep lines with product signals (price, KDV, weight, known food).
 */
function extractProductLines(lines: string[]): ExtractedProduct[] {
  const products: ExtractedProduct[] = [];

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();

    if (SKIP_PATTERNS.some((p) => p.test(trimmed))) continue;
    if (trimmed.length < 4) continue;

    // Standalone weight lines: 0.430 / 0,430 / 1.864 kg
    if (/^\d+[.,]\d{1,3}(\s*kg)?$/i.test(trimmed)) continue;

    const hasPrice =
      /[*]\d+[.,]\d{2}/.test(trimmed) || /\d+[.,]\d{2}\s*$/.test(trimmed);
    const hasKdvMarker = /%\d{1,2}/.test(trimmed);
    const hasProductCode = /\b[A-Z]{2,4}\d{2,3}\b/.test(trimmed);
    const hasUnitPrice = /TL\/(kg|ad|lt|adet)/i.test(trimmed);
    const hasQuantityPrefix = /\bx\d+[.,]?\d*/i.test(trimmed);

    let hasWeightLineBelow = false;
    let actualWeightGrams = 0;
    let quantity = 1;

    if (i + 1 < lines.length) {
      const nextLine = lines[i + 1].trim();
      const weightMatch = nextLine.match(/^(\d+)[.,](\d{1,3})(?:\s*kg)?$/i);
      if (weightMatch) {
        hasWeightLineBelow = true;
        const whole = parseInt(weightMatch[1], 10);
        const frac = weightMatch[2].padEnd(3, "0").slice(0, 3);
        actualWeightGrams = whole * 1000 + parseInt(frac, 10);
      }
    }

    // Adet: x2,00 TL/ad
    const adetMatch = trimmed.match(
      /\bx\s*(\d+)(?:[.,]\d+)?\s*TL\/ad(?:et)?/i
    );
    if (adetMatch) {
      quantity = Math.max(1, parseInt(adetMatch[1], 10));
    } else if (/TL\/ad(?:et)?/i.test(trimmed)) {
      const qtyOnly = trimmed.match(/\bx\s*(\d+)/i);
      if (qtyOnly) quantity = Math.max(1, parseInt(qtyOnly[1], 10));
    }

    // Pack count "15LI" (eggs)
    const packLi = trimmed.match(/\b(\d{1,2})\s*LI\b/i);
    if (packLi && quantity === 1) {
      const n = parseInt(packLi[1], 10);
      if (n >= 2 && n <= 60) quantity = n;
    }

    const hasProductSignal =
      hasPrice ||
      hasKdvMarker ||
      hasProductCode ||
      hasUnitPrice ||
      hasQuantityPrefix ||
      hasWeightLineBelow;

    let matchesKnownFood = false;
    if (!hasProductSignal) {
      const lower = normalizeTurkish(trimmed);
      matchesKnownFood = [
        ...HEALTHY_KEYWORDS,
        ...UNHEALTHY_KEYWORDS,
        ...NEUTRAL_KEYWORDS,
      ].some((kw) => matchKeyword(lower, kw));
      if (!matchesKnownFood) {
        matchesKnownFood = SORTED_ALIAS_ENTRIES.some(([alias]) =>
          lower.includes(normalizeTurkish(alias))
        );
      }
    }

    if (!hasProductSignal && !matchesKnownFood) continue;

    const { cleaned, weightGrams } = cleanProductLine(
      trimmed,
      actualWeightGrams
    );
    actualWeightGrams = weightGrams;

    if (!cleaned || cleaned.length < 2) continue;
    if (cleaned.match(/^[\d\s\/\-:,.]+$/)) continue;
    if (NON_FOOD_PATTERNS.some((p) => p.test(cleaned))) continue;

    products.push({ name: cleaned, actualWeightGrams, quantity });

    if (hasWeightLineBelow) i++;
  }

  return products;
}

/**
 * Strip prices, KDV, brands, egg grades, volumes → clean product name.
 * Exported for unit tests.
 */
export function cleanProductLine(
  raw: string,
  existingWeightGrams: number = 0
): { cleaned: string; weightGrams: number } {
  let cleaned = raw;
  let actualWeightGrams = existingWeightGrams;

  cleaned = cleaned.replace(/%\d{1,2}/g, "").trim();
  cleaned = cleaned.replace(/\bx\d+[.,]?\d*\b/gi, "").trim();
  cleaned = cleaned.replace(/[*]?\d+[.,]\d{2}\s*$/, "").trim();
  cleaned = cleaned.replace(/TL\/(kg|ad|lt|adet)/gi, "").trim();
  cleaned = cleaned.replace(/\bTL\b\s*$/i, "").trim();
  cleaned = cleaned.replace(/^\d+[.,]\d{1,3}\b\s*/, "").trim();

  // Egg pack / grade FIRST so "63-72 G" is never parsed as product weight
  cleaned = cleaned.replace(/\b\d+\s*LI\b/gi, "").trim();
  cleaned = cleaned.replace(/\b[SML]\s+\d{2}\s*-\s*\d{2}(?:\s*G)?\b/gi, "").trim();
  cleaned = cleaned.replace(/\b\d{2}\s*-\s*\d{2}(?:\s*G)?\b/gi, "").trim();
  cleaned = cleaned.replace(/\b([SML])\b(?=\s*$|\s+\d)/gi, "").trim();

  if (!actualWeightGrams) {
    const inlineWeight =
      cleaned.match(/(\d+)\s*G\b/i) || cleaned.match(/\((\d+)\s*G?\)/i);
    if (inlineWeight) {
      const inlineGrams = parseInt(inlineWeight[1], 10);
      if (inlineGrams >= 10 && inlineGrams <= 5000) {
        actualWeightGrams = inlineGrams;
      }
    }
    const inlineKg = cleaned.match(/(\d+)[.,](\d{1,3})\s*kg\b/i);
    if (inlineKg && !actualWeightGrams) {
      const whole = parseInt(inlineKg[1], 10);
      const frac = inlineKg[2].padEnd(3, "0").slice(0, 3);
      actualWeightGrams = whole * 1000 + parseInt(frac, 10);
    }
    const wholeKg = cleaned.match(/\b(\d+)\s*kg\b/i);
    if (wholeKg && !actualWeightGrams) {
      const kg = parseInt(wholeKg[1], 10);
      if (kg >= 1 && kg <= 50) actualWeightGrams = kg * 1000;
    }
  }

  // Weights / volumes
  cleaned = cleaned.replace(/\b\d+\s*G\b/gi, "").trim();
  cleaned = cleaned.replace(/\b\d+[.,]\d{1,3}\s*kg\b/gi, "").trim();
  cleaned = cleaned.replace(/\b\d+\s*kg\b/gi, "").trim();
  cleaned = cleaned.replace(/\b\d+[.,]?\d*\s*L\b/gi, "").trim(); // 1 L, 1.5 L

  // Product codes, HL
  cleaned = cleaned.replace(/\b[A-Z]{2,4}\d{2,3}\b/g, "").trim();
  cleaned = cleaned.replace(/\b\d+\s*HL\b/gi, "").trim();
  cleaned = cleaned.replace(/\bHL\b/gi, "").trim();

  cleaned = cleaned.replace(/\(\d+[Gg]?\)/gi, "").trim();
  cleaned = cleaned.replace(/\(\s*\)/g, "").trim();

  // Brands / cultivars / packaging tokens
  cleaned = cleaned.replace(STRIP_TOKEN_REGEX, "").trim();

  // Instant coffee noise: "17. N", "17.5", trailing single Latin letter codes
  cleaned = cleaned.replace(/\b\d+[.,]\d+\b/g, "").trim();
  cleaned = cleaned.replace(/\b\d+\.\s*[A-Z]?\b/gi, "").trim();
  cleaned = cleaned.replace(/\s+\d{1,2}$/, "").trim();
  cleaned = cleaned.replace(/\s+[A-Z]$/i, "").trim(); // trailing "N" / "CAF" partially

  cleaned = cleaned.replace(/x\d+[.,]?\d*/gi, "").trim();
  cleaned = cleaned
    .replace(/^[*\-\u2013\u2014\u00b7.]+/, "")
    .replace(/[*\-\u2013\u2014\u00b7.]+$/, "")
    .trim();
  cleaned = cleaned.replace(/\s{2,}/g, " ").trim();

  // Drop digit-only and single-character leftover tokens (egg grade "L", noise "N")
  cleaned = cleaned
    .split(/\s+/)
    .filter((tok) => tok.length > 1 && !/^\d+$/.test(tok))
    .join(" ")
    .trim();

  return { cleaned, weightGrams: actualWeightGrams };
}

async function classifyProduct(
  productName: string,
  actualWeightGrams: number = 0,
  quantity: number = 1
): Promise<ClassificationResult> {
  const normalized = normalizeTurkish(productName.trim());
  const qty = quantity > 0 ? quantity : 1;

  // Resolve alias → canonical id (longest match first)
  let resolvedName = normalized;
  for (const [alias, canonical] of SORTED_ALIAS_ENTRIES) {
    if (normalized.includes(normalizeTurkish(alias))) {
      resolvedName = normalizeTurkish(canonical);
      break;
    }
  }

  const isHealthyProcessedWhitelist = HEALTHY_PROCESSED_KEYWORDS.some((kw) =>
    matchKeyword(normalized, kw)
  );

  const isProcessedOrComposite =
    !isHealthyProcessedWhitelist &&
    PROCESSED_OR_COMPOSITE_KEYWORDS.some((kw) => matchKeyword(normalized, kw));

  let isFruitVeg = false;
  let estimatedGrams = 0;

  if (!isProcessedOrComposite) {
    for (const [keyword, defaultGrams] of Object.entries(FRUIT_VEG_KEYWORDS)) {
      if (
        matchKeyword(resolvedName, keyword) ||
        matchKeyword(normalized, keyword)
      ) {
        isFruitVeg = true;
        estimatedGrams = defaultGrams;
        break;
      }
    }
  }

  let fruitVegGrams = 0;
  if (isFruitVeg) {
    fruitVegGrams =
      actualWeightGrams > 0 ? actualWeightGrams : estimatedGrams * qty;
  }

  let isHealthy = HEALTHY_KEYWORDS.some(
    (kw) => matchKeyword(resolvedName, kw) || matchKeyword(normalized, kw)
  );

  if (isProcessedOrComposite) {
    const nonFruitVegHealthyKeywords = HEALTHY_KEYWORDS.filter(
      (kw) => !FRUIT_VEG_IDS.has(normalizeTurkish(kw))
    );
    isHealthy = nonFruitVegHealthyKeywords.some(
      (kw) => matchKeyword(resolvedName, kw) || matchKeyword(normalized, kw)
    );
  }

  const isUnhealthy = UNHEALTHY_KEYWORDS.some(
    (kw) => matchKeyword(resolvedName, kw) || matchKeyword(normalized, kw)
  );

  if (isHealthy && isUnhealthy) {
    return {
      name: productName,
      category: "unhealthy",
      fruitVegGrams: 0,
      confidence: 0.7,
    };
  }

  if (isHealthy) {
    return {
      name: productName,
      category: "healthy",
      fruitVegGrams,
      confidence: 0.85,
    };
  }

  if (isUnhealthy) {
    return {
      name: productName,
      category: "unhealthy",
      fruitVegGrams: 0,
      confidence: 0.85,
    };
  }

  const isKnownNeutral = NEUTRAL_KEYWORDS.some(
    (kw) => matchKeyword(resolvedName, kw) || matchKeyword(normalized, kw)
  );
  if (isKnownNeutral) {
    return {
      name: productName,
      category: "neutral",
      fruitVegGrams: 0,
      confidence: 0.75,
    };
  }

  if (process.env.USE_OFF_API === "true") {
    try {
      const offResult = await queryOpenFoodFacts(
        productName,
        actualWeightGrams > 0 ? actualWeightGrams : 0
      );
      if (offResult) return offResult;
    } catch (error) {
      console.warn("OFF API failed, using fallback:", error);
    }
  }

  return {
    name: productName,
    category: "neutral",
    fruitVegGrams,
    confidence: 0.5,
  };
}

/**
 * Open Food Facts lookup.
 * `fruits_vegetables_nuts_100g` = grams fruit/veg per 100g product → scale by weight.
 */
async function queryOpenFoodFacts(
  productName: string,
  productWeightGrams: number = 0
): Promise<ClassificationResult | null> {
  if (!offCache) return null;

  const cacheKey = `${normalizeTurkish(productName)}|${productWeightGrams}`;
  if (offCache.has(cacheKey)) {
    return offCache.get(cacheKey) ?? null;
  }

  try {
    const response = await axios.get(OFF_SEARCH, {
      params: {
        search_terms: productName,
        fields: "product_name,nutriscore_grade,fruits_vegetables_nuts_100g",
        page_size: 1,
        json: 1,
      },
      timeout: 1000,
    });

    const products = response.data?.products;
    if (!products || products.length === 0) {
      offCache.set(cacheKey, null);
      return null;
    }

    const product = products[0];
    const nutriscore = product.nutriscore_grade?.toUpperCase();
    const fruitVegPer100g = Number(product.fruits_vegetables_nuts_100g) || 0;

    let category: "healthy" | "unhealthy" | "neutral" = "neutral";
    if (nutriscore === "A" || nutriscore === "B") category = "healthy";
    else if (nutriscore === "D" || nutriscore === "E") category = "unhealthy";

    const weightForScale = productWeightGrams > 0 ? productWeightGrams : 100;
    const fruitVegGrams = Math.round((fruitVegPer100g / 100) * weightForScale);

    const result: ClassificationResult = {
      name: productName,
      category,
      nutriscore,
      fruitVegGrams,
      confidence: 0.9,
    };
    offCache.set(cacheKey, result);
    return result;
  } catch {
    offCache.set(cacheKey, null);
    return null;
  }
}

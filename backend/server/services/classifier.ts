import axios from "axios";

const OFF_API = "https://world.openfoodfacts.org/api/v2/product";
const OFF_SEARCH = "https://world.openfoodfacts.org/api/v2/search";

// Only create cache when OFF API is enabled
const offCache = process.env.USE_OFF_API === "true"
  ? new Map<string, ClassificationResult | null>()
  : null;

// Debug logging — suppressed in production
const DEBUG = process.env.NODE_ENV !== "production";
function debugLog(...args: unknown[]) {
  if (DEBUG) console.log(...args);
}

const matchKeyword = (text: string, keyword: string): boolean => {
  if (keyword.length <= 2) {
    const escaped = keyword.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    // Enforce word boundaries including Turkish alphanumeric characters
    // Only for very short keywords (≤2 chars like "su") to avoid false positives
    const regex = new RegExp(`(?:^|[^a-zA-Z0-9çğışöüÇĞİŞÖÜ])${escaped}(?:$|[^a-zA-Z0-9çğışöüÇĞİŞÖÜ])`, 'i');
    return regex.test(text);
  }
  return text.toLowerCase().includes(keyword.toLowerCase());
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
}

export interface FoodClassification {
  totalItems: number;
  healthyItems: number;
  unhealthyItems: number;
  fruitVegGrams: number;
  products: ClassificationResult[];
}

// ─── Turkish → normalized mapping for common OCR misreadings ─────────
// OCR often reads Turkish characters wrong or drops them. This map
// normalizes common product names from Turkish grocery receipts.
const TURKISH_PRODUCT_ALIASES: Record<string, string> = {
  // OCR common misreadings
  "lumon": "limon",
  "seftall": "seftali",
  "seftal": "seftali",
  "donates": "domates",
  "lcecek": "icecek",
  "haden": "maden",
  "nektart": "nektari",
  "lavas": "lavas",

  // Fruits
  "elma starking": "elma",
  "elma granny smith": "elma",
  "elma granny": "elma",
  "armut deveci": "armut",
  "armut santa maria": "armut",
  "portakal": "portakal",
  "limon": "limon",
  "muz": "muz",
  "cilek": "cilek",
  "uzum": "uzum",
  "karpuz": "karpuz",
  "kavun": "kavun",
  "seftali": "seftali",
  "kayisi": "kayisi",
  "kiraz": "kiraz",
  "visne": "visne",
  "erik": "erik",
  "incir": "incir",
  "nar": "nar",
  "mandalina": "mandalina",

  // Vegetables
  "domates": "domates",
  "salalik": "salatalik",
  "salatalik": "salatalik",
  "biber carliston": "biber",
  "biber dolmalik": "biber",
  "biber sivri": "biber",
  "biber": "biber",
  "patates": "patates",
  "sogan": "sogan",
  "sarimsak": "sarimsak",
  "havuc": "havuc",
  "ispanak": "ispanak",
  "maydanoz": "maydanoz",
  "dereotu": "dereotu",
  "nane": "nane",
  "roka": "roka",
  "marul": "marul",
  "lahana": "lahana",
  "kabak": "kabak",
  "patlican": "patlican",
  "brokoli": "brokoli",
  "karnabahar": "karnabahar",
  "turp": "turp",
  "pirasa": "pirasa",
  "kereviz": "kereviz",
  "enginar": "enginar",
  "bamya": "bamya",
  "bezelye": "bezelye",
  "fasulye taze": "fasulye",
  "barbunya taze": "barbunya",
  "semizotu": "semizotu",

  // Meat & Protein
  "tavuk but": "tavuk",
  "tavuk gogus": "tavuk",
  "tavuk kanat": "tavuk",
  "butun tavuk": "tavuk",
  "tavuk baget": "tavuk",
  "dana kiyma": "dana",
  "kuzu kiyma": "kuzu",
  "dana kusbasi": "dana",
  "dana bonfile": "dana",
  "dana antrikot": "dana",
  "kuzu pirzola": "kuzu",

  // Dairy
  "sut yagli": "sut",
  "sut yarim yagli": "sut",
  "sut yagli 1 l": "sut",

  // Tea / Coffee  
  "cay turkak": "cay",
  "cay caykur": "cay",
};

// ─── Healthy keywords (Turkish + English) ─────────────────────────────
const HEALTHY_KEYWORDS = [
  // English
  "organic", "vegetable", "fruit", "salad", "spinach", "broccoli", "carrot",
  "apple", "banana", "orange", "berry", "tomato", "lettuce", "kale",
  "chicken breast", "chicken", "fish", "salmon", "turkey", "egg", "yogurt", "oat",
  "brown rice", "quinoa", "beans", "lentil", "almond", "walnut", "avocado",
  "olive oil", "green tea", "water", "milk",

  // Turkish — fruits
  "elma", "muz", "portakal", "limon", "cilek", "uzum", "karpuz", "kavun",
  "seftali", "kayisi", "kiraz", "visne", "erik", "incir", "nar", "mandalina",
  "armut",

  // Turkish — vegetables
  "domates", "salatalik", "salalik", "biber", "patates", "sogan", "sarimsak",
  "havuc", "ispanak", "maydanoz", "dereotu", "nane", "roka", "marul",
  "lahana", "kabak", "patlican", "brokoli", "karnabahar", "turp", "pirasa",
  "kereviz", "enginar", "bamya", "bezelye", "semizotu",

  // Turkish — protein
  "tavuk", "balik", "ton", "somon", "levrek", "cipura", "hamsi", "sardalya",
  "dana", "kuzu",
  "yumurta",

  // Turkish — dairy
  "sut", "yogurt", "ayran", "kefir", "lor", "peynir", "tulum",

  // Turkish — grains & legumes
  "mercimek", "nohut", "fasulye", "bulgur", "yulaf", "pirinc", "tam bugday",
  "siyez", "kinoa",

  // Turkish — nuts (raw/natural)
  "ceviz", "findik", "badem", "antep fistigi", "yer fistigi", "kuruyemis",
  "fistik", "kaju",

  // Turkish — other healthy
  "zeytinyagi", "zeytin", "bal", "salata", "cay",
  "su",
];

// ─── Unhealthy keywords (Turkish + English) ───────────────────────────
const UNHEALTHY_KEYWORDS = [
  // English
  "soda", "cola", "chips", "cookie", "candy", "chocolate", "cake",
  "donut", "ice cream", "frozen pizza", "hot dog", "bacon", "sausage",
  "fried", "fast food", "burger", "pizza", "energy drink", "alcohol",
  "corn syrup",

  // Turkish — sweets & snacks
  "cikolata", "biskuvi", "kek", "pasta", "gofret", "goofret",
  "cips", "seker toz", "seker",
  "dondurma", "lokum", "jelibon",

  // Turkish — processed meat
  "salam", "sosis", "sucuk", "pastirma",

  // Turkish — sauces & processed
  "ketcap", "mayonez", "hazir corba", "hazir yemek",
  "margarin",

  // Turkish — drinks
  "gazoz", "kolali", "enerji icecegi", "malt",

  // Turkish — instant/processed coffee & bars
  "kahve ins", "3u 1 arada", "3 u 1 arada",
  "bar kakao", "kakao kapl",

  // Turkish — fried / fast
  "kizartma",
];

// ─── Lines / keywords to fully SKIP (not a food product) ──────────────
const SKIP_PATTERNS = [
  /^(TOTAL|SUBTOTAL|TAX|DATE|STORE|CASHIER|CHANGE|RECEIPT)/i,
  /^(TOPLAM|KDV|FIS|FİŞ|SAAT|TARIH|ARA TOPLAM|ALISVERIS|ALIŞVERİŞ|NAKIT|BANKA)/i,
  /^(BELGE|ETTN|FISC|KASA|DARA|ADET|ISKONTO|İSKONTO|INDIRIM|İNDİRİM)/i,
  /^\d{2}[./-]\d{2}[./-]\d{2,4}/, // dates
  /^[\d\/\-:,x\s]+$/,             // pure numbers / weight lines
  /^[*\-=]+$/,                     // separator lines
  /^ALI[SŞ]VERI[SŞ]\s*PO[SŞ]ET/i, // bags (not food)
  /\bPO[SŞ]ET\b$/i,                // trailing POSET/POŞET (bag line, not food)
  /^TEL:|^FAX:/i,
  /THANK|TE[SŞ]EKK[UÜ]R/i,
  
  // Robust filters for receipt meta lines — all Turkish chars written literally
  /\b(MERSIS|VKN|VERG[İI]|DAIRE|DAİRE|SICIL|SİCİL|ADRES|FATURA|E-ARŞİV|E-ARSIV|EARSIV|EARŞİV|GIB|GİB|KASİYER|KASIYER|KASAYER|TERMINAL|İŞLEM|ISLEM|NUSHA|NÜSHA|MÜŞTERİ|MUSTERI|BANKA|KREDİ|KREDI|KREDL|KART|KARTI|PUAN|BAKİYE|BAKIYE|PROVİZYON|PROVIZYON|MATRAH|İADE|IADE|ÖDEME|ODEME|BEKLERIZ|İLETİŞİM|ILETISIM|YINE BEKLERIZ|TEL|FAX|WEB|EPOSTA|E-POSTA|TEŞEKKÜR|TESEKKUR|İŞYERİ|ISYERI|UNVAN|TABELA|HOŞGELDİNİZ|HOSGELDINIZ|FİYAT|FIYAT|FİYATI|FIYATI|TUTAR|TUTARI|KDVSIZ|KDV'Lİ|KDVLI|MH|MAH|MAHALLESİ|MAHALLESI|SOK|SOKAK|SOKAĞI|SOKAGI|CAD|CADDESİ|CADDESI|NO|İLÇE|ILCE|İLÇESİ|ILCESI|İL|IL|İLİ|ILI|TÜRKİYE|TURKIYE|ESENYURT|ÜSKÜDAR|USKUDAR|İSTANBUL|ISTANBUL|YAPI KREDİ|YAPI KREDI|YAPI KREDL|ECZACILIK|HACIAZICILIK|ANONİM|ANONIM|ŞİRKETİ|SIRKETI|LTD|ŞTİ|STI|ARA TOPLAM|ARA TOPLAN|TOPEDY|TOPLAM)\b/i,
];

// ─── Packaged / processed product keywords (to exclude from fresh fruit/veg grams) ───
const PROCESSED_OR_COMPOSITE_KEYWORDS = [
  "suyu", "sut", "süt", "sos", "sirke", "recel", "reçel", "pure", "püre",
  "biskuvi", "bisküvi", "gofret", "cips", "kek", "pasta", "aroma", "konserve", 
  "tursu", "turşu", "yogurt", "yoğurt", "dondurma", "makarna", "pizza", "corba", 
  "çorba", "un", "ekmek", "salca", "salça", "seker", "şeker", "cikolata", 
  "çikolata", "goofret", "salam", "sosis", "sucuk", "pastirma", "pastırma", 
  "hazir", "hazır", "bar", "borek", "börek", "pogaça", "poğaça", "simit", 
  "tost", "sandvic", "sandviç", "durum", "dürüm", "kebap", "doner", "döner", 
  "kofte", "köfte", "manti", "mantı", "erişte", "eriste", "pilav", "tatli", 
  "tatlı", "helva", "pekmez", "tahin", "kaymak", "tereyag", "tereyağ", 
  "margarin", "yag", "yağ", "peynir", "lor", "kasar", "kaşar", "krema", 
  "ayran", "kefir", "cacik", "cazık", "meze", "kraker", "kurabiye", "lokum", 
  "jelibon", "sakiz", "sakız", "gazoz", "kola", "cola", "fanta", "sprite", 
  "icecek", "içecek", "limonata", "serbet", "şerbet", "komposto", "hosaf", 
  "hoşaf", "salamura", "dondurulmus", "dondurulmuş", "kurutulmus", "kurutulmuş", 
  "ketcap", "ketçap", "mayonez", "hardal", "tuz", "baharat"
];

// Whitelist of processed items that are actually healthy whole foods on their own
const HEALTHY_PROCESSED_KEYWORDS = [
  "sut", "süt", "yogurt", "yoğurt", "ayran", "kefir", "lor", "peynir", 
  "zeytinyagi", "zeytinyağı", "su", "cay", "çay", "yumurta", "maden suyu"
];

// ─── Fruit & vegetable gram estimates ─────────────────────────────────
const FRUIT_VEG_KEYWORDS: Record<string, number> = {
  // English
  "banana": 120, "apple": 180, "orange": 200, "avocado": 150,
  "tomato": 100, "broccoli": 150, "carrot": 60, "spinach": 30,
  "blueberry": 80, "strawberry": 100, "grape": 100,
  // Turkish
  "muz": 120, "elma": 180, "portakal": 200, "avokado": 150,
  "domates": 100, "brokoli": 150, "havuc": 60, "ispanak": 30,
  "salatalik": 100, "salalik": 100, "biber": 100, "sogan": 80,
  "patates": 150, "limon": 80, "maydanoz": 30, "armut": 160,
  "cilek": 100, "uzum": 100, "karpuz": 300, "kavun": 250,
  "seftali": 150, "kayisi": 80, "kiraz": 100, "visne": 80,
  "erik": 80, "incir": 60, "nar": 200, "mandalina": 100,
  "lahana": 200, "kabak": 200, "patlican": 200,
  "pirasa": 150, "kereviz": 100, "turp": 50,
  "dereotu": 20, "nane": 10, "roka": 30, "marul": 100,
  "bamya": 100, "bezelye": 100,
};

/**
 * Classify food items from receipt lines.
 */
export async function classifyFoods(lines: string[]): Promise<FoodClassification> {
  const products: ClassificationResult[] = [];
  let healthyItems = 0;
  let unhealthyItems = 0;
  let fruitVegGrams = 0;

  // Extract potential product lines with actual weights
  const productLines = extractProductLines(lines);
  debugLog(`🔍 Extracted ${productLines.length} product lines:`,
    productLines.map(p => `${p.name}${p.actualWeightGrams ? ` (${p.actualWeightGrams}g)` : ''}`)
  );

  for (const item of productLines) {
    const classification = await classifyProduct(item.name, item.actualWeightGrams);
    products.push(classification);
    debugLog(`   → "${item.name}" => ${classification.category} (${classification.fruitVegGrams}g fruit/veg${item.actualWeightGrams ? ', actual weight' : ', estimated'})`);

    if (classification.category === "healthy") {
      healthyItems++;
    } else if (classification.category === "unhealthy") {
      unhealthyItems++;
    }

    fruitVegGrams += classification.fruitVegGrams;
  }

  debugLog(`📊 Final: ${productLines.length} total, ${healthyItems} healthy, ${unhealthyItems} unhealthy, ${fruitVegGrams}g fruit/veg`);

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
 * STRATEGY: Uses a two-phase approach:
 * 
 * Phase 1 (NEGATIVE FILTER): Skip lines that are clearly NOT products:
 *   - Store headers, addresses, dates, totals, payment info, separators
 *   
 * Phase 2 (POSITIVE SIGNAL): Among remaining lines, ONLY accept lines that
 *   have at least one "product signal" — evidence that this line is a real
 *   product entry on the receipt. Turkish receipts mark products with:
 *   - Price patterns: *87,50 or trailing XX,YY
 *   - KDV markers: %01, %08, %18, %20
 *   - Product/KDV category codes: DIN10, CN01, MK01, LIN10, DN10
 *   - Unit pricing: TL/kg, TL/ad, TL/lt  
 *   - Quantity prefixes: x125,00
 *   - Weight lines following (0.430 kg format)
 *   - OR the line matches a known food keyword (for simple single-word items like "PATATES")
 */
function extractProductLines(lines: string[]): ExtractedProduct[] {
  const products: ExtractedProduct[] = [];

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();

    // Skip via SKIP_PATTERNS (negative filter for receipt metadata)
    if (SKIP_PATTERNS.some(p => p.test(trimmed))) {
      continue;
    }

    // Skip very short lines (< 4 chars)
    if (trimmed.length < 4) {
      continue;
    }

    // Check if this line is a standalone weight (kg)
    if (/^\d+[.,]\d{3}$/.test(trimmed)) {
      continue;
    }

    // ── POSITIVE SIGNAL CHECK ──
    const hasPrice = /[*]\d+[.,]\d{2}/.test(trimmed) || /\d+[.,]\d{2}\s*$/.test(trimmed);
    const hasKdvMarker = /%\d{1,2}/.test(trimmed);
    const hasProductCode = /\b[A-Z]{2,4}\d{2,3}\b/.test(trimmed);
    const hasUnitPrice = /TL\/(kg|ad|lt|adet)/i.test(trimmed);
    const hasQuantityPrefix = /\bx\d+[.,]?\d*/i.test(trimmed);
    
    let hasWeightLineBelow = false;
    let actualWeightGrams = 0;
    if (i + 1 < lines.length) {
      const nextLine = lines[i + 1].trim();
      const weightMatch = nextLine.match(/^(\d+)[.,](\d{3})$/);
      if (weightMatch) {
        hasWeightLineBelow = true;
        const kg = parseInt(weightMatch[1]);
        const grams = parseInt(weightMatch[2]);
        actualWeightGrams = kg * 1000 + grams;
      }
    }
    // NOTE: We skip the weight line after pushing the product (see below)

    const hasProductSignal = hasPrice || hasKdvMarker || hasProductCode || hasUnitPrice || hasQuantityPrefix || hasWeightLineBelow;

    // If no product signal, check if the line matches a known food keyword
    let matchesKnownFood = false;
    if (!hasProductSignal) {
      const lower = trimmed.toLowerCase();
      matchesKnownFood = [...HEALTHY_KEYWORDS, ...UNHEALTHY_KEYWORDS].some(kw =>
        matchKeyword(lower, kw)
      );
      if (!matchesKnownFood) {
        matchesKnownFood = Object.keys(TURKISH_PRODUCT_ALIASES).some(alias =>
          lower.includes(alias)
        );
      }
    }

    // Skip if no product signal and no food keyword match
    if (!hasProductSignal && !matchesKnownFood) {
      continue;
    }

    // ── CLEANING PHASE ──
    let cleaned = trimmed;

    cleaned = cleaned.replace(/%\d{1,2}/g, "").trim();
    cleaned = cleaned.replace(/\bx\d+[.,]?\d*\b/gi, "").trim();
    cleaned = cleaned.replace(/[*]?\d+[.,]\d{2}\s*$/, "").trim();
    cleaned = cleaned.replace(/TL\/(kg|ad|lt|adet)/gi, "").trim();
    cleaned = cleaned.replace(/\bTL\b\s*$/i, "").trim();
    cleaned = cleaned.replace(/^\d+[.,]\d{3}\b\s*/, "").trim();

    if (!actualWeightGrams) {
      const inlineWeight = cleaned.match(/(\d+)\s*G\b/i);
      if (inlineWeight) {
        const inlineGrams = parseInt(inlineWeight[1]);
        if (inlineGrams >= 10 && inlineGrams <= 5000) {
          actualWeightGrams = inlineGrams;
        }
      }
    }

    cleaned = cleaned.replace(/\b\d+\s*G\b/gi, "").trim();
    cleaned = cleaned.replace(/\b[A-Z]{2,4}\d{2,3}\b/g, "").trim();
    cleaned = cleaned.replace(/\b\d+\s*HL\b/gi, "").trim();
    cleaned = cleaned.replace(/\bHL\b/gi, "").trim();
    cleaned = cleaned.replace(/\b\d+LI\s+L\s+\d+-\d+\b/gi, "").trim();
    cleaned = cleaned.replace(/\(\d+[Gg]?\)/gi, "").trim();
    cleaned = cleaned.replace(/\bPAKET\b/gi, "").trim();
    cleaned = cleaned.replace(/\bPOSETLI\b/gi, "").trim();
    cleaned = cleaned.replace(/\(\s*\)/g, "").trim();
    cleaned = cleaned.replace(/\b(PETEK|COKCA|VERA|BIRSAN|CAYKUR|NIMET|DEVECI|CARLISTON|BERONA|BEYPAZA|BEYPAZARI|HEYWELL|MOLPED|HOLPED)\b/gi, "").trim();
    cleaned = cleaned.replace(/\s+\d{1,2}$/, "").trim();
    cleaned = cleaned.replace(/x\d+[.,]?\d*/gi, "").trim();
    cleaned = cleaned.replace(/^[*\-\u2013\u2014\u00b7.]+/, "").replace(/[*\-\u2013\u2014\u00b7.]+$/, "").trim();
    cleaned = cleaned.replace(/\s{2,}/g, " ").trim();

    if (cleaned.match(/^[\d\s\/\-:,.]+$/) || cleaned.length < 2) {
      continue;
    }

    // Skip non-food products (hygiene, cleaning, household)
    if (NON_FOOD_PATTERNS.some(p => p.test(cleaned))) {
      continue;
    }

    products.push({ name: cleaned, actualWeightGrams });

    // Skip the weight line so it is not re-evaluated as a product
    if (hasWeightLineBelow) {
      i++;
    }
  }

  return products;
}

// ─── Non-food products found on grocery receipts ──────────────────────
const NON_FOOD_PATTERNS = [
  /\b(PED|HİJYEN|HIJYEN|PEÇETE|PECETE|HAVLU|KAĞIT|KAGIT|MENDİL|MENDIL|DETERJAN|SABUN|ŞAMPUAN|SAMPUAN|DURULAY|YUMUŞATICI|YUMUSATICI|ÇAMAŞIR|CAMASIR|BULAŞIK|BULASIK)\b/i,
  /\b(MOLPED|HOLPED|ORKİD|ORKID|KOTEX|ALWAYS|PRİMA|PRIMA|PAMPERS|HUGGIES)\b/i,
  /\b(ÇÖP\s*POŞET|COP\s*POSET|ÇÖP\s*PO[SŞ]ET|COP\s*PO[SŞ]ET|TORBA|FIRIN TORBASI)\b/i,
  /\b(AMPUL|PİL|PIL|BATARYA|LAMBA|DEODORANT|KREM|LOSYON|TIRNAK|DİŞ FIR[CÇ]ASI|DIS FIRCASI|DİŞ MACUNU|DIS MACUNU|DIPMACUNU|TRAŞ|TRAS)\b/i,
];

/**
 * Classify a single product line.
 * @param actualWeightGrams - Real weight from receipt (0 = use estimate)
 */
// Pre-sort aliases by length (longest first) so more specific aliases match before shorter ones.
// E.g. "elma granny smith" matches before "elma".
const SORTED_ALIASES = Object.entries(TURKISH_PRODUCT_ALIASES)
  .sort(([a], [b]) => b.length - a.length);

async function classifyProduct(productName: string, actualWeightGrams: number = 0): Promise<ClassificationResult> {
  const normalized = productName.toLowerCase().trim();

  // Step 1: Try to resolve Turkish aliases (longest-first to prefer specific matches)
  let resolvedName = normalized;
  for (const [alias, canonical] of SORTED_ALIASES) {
    if (normalized.includes(alias)) {
      resolvedName = canonical;
      break;
    }
  }

  // Step 2: Check whitelist FIRST — healthy processed items (süt, yoğurt, ayran etc.)
  // should not be penalized by the processed/composite check.
  const isHealthyProcessedWhitelist = HEALTHY_PROCESSED_KEYWORDS.some(kw =>
    matchKeyword(normalized, kw)
  );

  // Packaged/processed products do NOT count as fresh fruits & vegetables,
  // BUT whitelisted healthy products (milk, yogurt, etc.) are exempt.
  const isProcessedOrComposite = !isHealthyProcessedWhitelist &&
    PROCESSED_OR_COMPOSITE_KEYWORDS.some(kw =>
      matchKeyword(normalized, kw)
    );

  // Step 3: Check if this is a fruit/veg and calculate grams
  let isFruitVeg = false;
  let estimatedGrams = 0;

  if (!isProcessedOrComposite) {
    for (const [keyword, defaultGrams] of Object.entries(FRUIT_VEG_KEYWORDS)) {
      if (matchKeyword(resolvedName, keyword) || matchKeyword(normalized, keyword)) {
        isFruitVeg = true;
        estimatedGrams = defaultGrams;
        break;
      }
    }
  }

  // Use actual weight from receipt if available, otherwise use estimate
  let fruitVegGrams = 0;
  if (isFruitVeg) {
    fruitVegGrams = actualWeightGrams > 0 ? actualWeightGrams : estimatedGrams;
  }

  // Step 4: Keyword classification using both original and resolved names
  let isHealthy = HEALTHY_KEYWORDS.some(kw =>
    matchKeyword(resolvedName, kw) || matchKeyword(normalized, kw)
  );

  // If a product is processed/composite (and NOT whitelisted), restrict healthy
  // classification to non-fruit/veg healthy keywords only. This prevents
  // "portakal suyu" from being marked healthy just because of "portakal".
  if (isProcessedOrComposite) {
    const nonFruitVegHealthyKeywords = HEALTHY_KEYWORDS.filter(kw => 
      !Object.keys(FRUIT_VEG_KEYWORDS).includes(kw)
    );
    isHealthy = nonFruitVegHealthyKeywords.some(kw =>
      matchKeyword(resolvedName, kw) || matchKeyword(normalized, kw)
    );
  }
  const isUnhealthy = UNHEALTHY_KEYWORDS.some(kw =>
    matchKeyword(resolvedName, kw) || matchKeyword(normalized, kw)
  );

  // If both match, decide by specificity — unhealthy patterns are usually
  // more specific (e.g., "bar kakao" beats generic "findik" in the name)
  if (isHealthy && isUnhealthy) {
    // Unhealthy wins for processed/composite products
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

  // Step 5: Try Open Food Facts API for ambiguous items
  if (process.env.USE_OFF_API === "true") {
    try {
      const offResult = await queryOpenFoodFacts(productName);
      if (offResult) {
        return offResult;
      }
    } catch (error) {
      console.warn("OFF API failed, using fallback:", error);
    }
  }

  // Default to neutral
  return {
    name: productName,
    category: "neutral",
    fruitVegGrams,
    confidence: 0.5,
  };
}

/**
 * Query Open Food Facts API (with in-memory cache and 1-second timeout to prevent API hangs)
 */
async function queryOpenFoodFacts(productName: string): Promise<ClassificationResult | null> {
  // If OFF API is disabled, skip entirely (cache is also null)
  if (!offCache) return null;

  const cacheKey = productName.toLowerCase().trim();
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
      timeout: 1000, // Reduced to 1 second
    });

    const products = response.data?.products;
    if (!products || products.length === 0) {
      offCache.set(cacheKey, null);
      return null;
    }

    const product = products[0];
    const nutriscore = product.nutriscore_grade?.toUpperCase();
    const fruitVeg = product.fruits_vegetables_nuts_100g || 0;

    // Nutriscore: A/B = healthy, D/E = unhealthy, C = neutral
    let category: "healthy" | "unhealthy" | "neutral" = "neutral";
    if (nutriscore === "A" || nutriscore === "B") {
      category = "healthy";
    } else if (nutriscore === "D" || nutriscore === "E") {
      category = "unhealthy";
    }

    const result: ClassificationResult = {
      name: productName,
      category,
      nutriscore,
      fruitVegGrams: Math.round(fruitVeg),
      confidence: 0.9,
    };
    offCache.set(cacheKey, result);
    return result;
  } catch (error) {
    // Cache failures as null to avoid spamming slow requests
    offCache.set(cacheKey, null);
    return null;
  }
}

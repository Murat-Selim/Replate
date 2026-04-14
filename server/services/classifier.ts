import axios from "axios";

const OFF_API = "https://world.openfoodfacts.org/api/v2/product";
const OFF_SEARCH = "https://world.openfoodfacts.org/api/v2/search";

export interface ClassificationResult {
  name: string;
  category: "healthy" | "unhealthy" | "neutral";
  nutriscore?: string;
  fruitVegGrams: number;
  confidence: number;
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
  /^(TOPLAM|KDV|FIS|SAAT|TARIH|ARA TOPLAM|ALISVERIS|NAKIT|BANKA)/i,
  /^(BELGE|ETTN|FISC|KASA|DARA|ADET|ISKONTO|INDIRIM)/i,
  /^\d{2}[./-]\d{2}[./-]\d{2,4}/, // dates
  /^[\d\/\-:,x\s]+$/,             // pure numbers / weight lines
  /^[*\-=]+$/,                     // separator lines
  /^ALISVERIS POSET/i,             // bags (not food)
  /\bPOSET\b$/i,                    // trailing POSET (bag line, not food)
  /^TEL:|^FAX:/i,
  /THANK|TESEKKUR/i,
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

  // Extract potential product lines
  const productLines = extractProductLines(lines);
  console.log(`🔍 Extracted ${productLines.length} product lines:`, productLines);

  for (const line of productLines) {
    const classification = await classifyProduct(line);
    products.push(classification);
    console.log(`   → "${line}" => ${classification.category} (${classification.fruitVegGrams}g fruit/veg)`);

    if (classification.category === "healthy") {
      healthyItems++;
    } else if (classification.category === "unhealthy") {
      unhealthyItems++;
    }

    fruitVegGrams += classification.fruitVegGrams;
  }

  console.log(`📊 Final: ${productLines.length} total, ${healthyItems} healthy, ${unhealthyItems} unhealthy, ${fruitVegGrams}g fruit/veg`);

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
 * Handles Turkish receipt formats with KDV markers, quantity prefixes,
 * weight/kg indicators, and various price formats.
 */
function extractProductLines(lines: string[]): string[] {
  const products: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();

    // Skip via patterns
    if (SKIP_PATTERNS.some(p => p.test(trimmed))) {
      continue;
    }

    // Skip very short lines
    if (trimmed.length < 3) {
      continue;
    }

    let cleaned = trimmed;

    // Remove KDV markers: %01, %08, %18, %20 etc.
    cleaned = cleaned.replace(/%\d{1,2}/g, "").trim();

    // Remove quantity prefix: "x125,00", "x99,50", "x119,50"
    cleaned = cleaned.replace(/\bx\d+[.,]?\d*\b/gi, "").trim();

    // Remove price from end: *87,50 or *4,00 or 87.50
    cleaned = cleaned.replace(/[*]?\d+[.,]\d{2}\s*$/, "").trim();

    // Remove weight/unit suffixes: TL/kg, TL/ad, TL/lt
    cleaned = cleaned.replace(/TL\/(kg|ad|lt|adet)/gi, "").trim();

    // Remove trailing "TL" alone
    cleaned = cleaned.replace(/\bTL\b\s*$/i, "").trim();

    // Remove leading quantity: "1.864", "0.145", "0.430", "0.920" etc.
    cleaned = cleaned.replace(/^\d+[.,]\d{3}\b\s*/, "").trim();

    // Remove weight info like "2000 G", "384 G", "250 G", "500 G", "18 G", "200 G"
    // but keep the product name before it
    cleaned = cleaned.replace(/\b\d+\s*G\b/gi, "").trim();

    // Remove "15LI L 63-72" type pack specs (egg carton formats)
    cleaned = cleaned.replace(/\b\d+LI\s+L\s+\d+-\d+\b/gi, "").trim();

    // Remove pack info like "(300G)", "PAKET"
    cleaned = cleaned.replace(/\(\d+G\)/gi, "").trim();
    cleaned = cleaned.replace(/\bPAKET\b/gi, "").trim();

    // Remove "POSETLI" descriptor from food names (e.g., BUTUN TAVUK POSETLI)
    cleaned = cleaned.replace(/\bPOSETLI\b/gi, "").trim();

    // Remove empty parentheses leftover from bracket cleanup
    cleaned = cleaned.replace(/\(\s*\)/g, "").trim();

    // Remove brand/descriptor suffixes that aren't food: PETEK, COKCA, VERA, BIRSAN, CAYKUR, NIMET
    // These are brand names commonly on Turkish receipts
    cleaned = cleaned.replace(/\b(PETEK|COKCA|VERA|BIRSAN|CAYKUR|NIMET|DEVECI|CARLISTON)\b/gi, "").trim();

    // Remove "x number" patterns (quantity on Turkish receipts e.g., "x1,00")
    cleaned = cleaned.replace(/x\d+[.,]?\d*/gi, "").trim();

    // Remove leading/trailing special chars
    cleaned = cleaned.replace(/^[*\-–—·.]+/, "").replace(/[*\-–—·.]+$/, "").trim();

    // Remove multiple spaces
    cleaned = cleaned.replace(/\s{2,}/g, " ").trim();

    // Skip if it's now just numbers, dates or empty
    if (cleaned.match(/^[\d\s\/\-:,.]+$/) || cleaned.length < 2) {
      continue;
    }

    products.push(cleaned);
  }

  return products;
}

/**
 * Classify a single product line.
 */
async function classifyProduct(productName: string): Promise<ClassificationResult> {
  const normalized = productName.toLowerCase().trim();

  // Step 1: Try to resolve Turkish aliases first
  let resolvedName = normalized;
  for (const [alias, canonical] of Object.entries(TURKISH_PRODUCT_ALIASES)) {
    if (normalized.includes(alias)) {
      resolvedName = canonical;
      break;
    }
  }

  // Step 2: Check fruit/veg grams
  let fruitVegGrams = 0;
  for (const [keyword, grams] of Object.entries(FRUIT_VEG_KEYWORDS)) {
    if (resolvedName.includes(keyword) || normalized.includes(keyword)) {
      fruitVegGrams += grams;
      break; // Only count once per product
    }
  }

  // Step 3: Keyword classification using both original and resolved names
  const isHealthy = HEALTHY_KEYWORDS.some(kw =>
    resolvedName.includes(kw) || normalized.includes(kw)
  );
  const isUnhealthy = UNHEALTHY_KEYWORDS.some(kw =>
    resolvedName.includes(kw) || normalized.includes(kw)
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

  // Step 4: Try Open Food Facts API for ambiguous items
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
 * Query Open Food Facts API
 */
async function queryOpenFoodFacts(productName: string): Promise<ClassificationResult | null> {
  try {
    const response = await axios.get(OFF_SEARCH, {
      params: {
        search_terms: productName,
        fields: "product_name,nutriscore_grade,fruits_vegetables_nuts_100g",
        page_size: 1,
        json: 1,
      },
      timeout: 3000,
    });

    const products = response.data?.products;
    if (!products || products.length === 0) {
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

    return {
      name: productName,
      category,
      nutriscore,
      fruitVegGrams: Math.round(fruitVeg),
      confidence: 0.9,
    };
  } catch (error) {
    return null;
  }
}

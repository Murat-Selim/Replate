/**
 * Single source of truth for food product classification.
 * Keyword lists, fruit/veg grams, and OCR aliases are derived from this catalog.
 */

export type FoodCategory = "healthy" | "unhealthy" | "neutral";

export interface CatalogEntry {
  /** Canonical id (normalized Turkish, no diacritics) */
  id: string;
  category: FoodCategory;
  /** Default fruit/veg grams per piece when weight missing; only for fresh produce */
  fruitVegGrams?: number;
  /** Extra match phrases that resolve to this id (OCR variants, EN names, receipt forms) */
  aliases?: string[];
  /**
   * Packaged product that is still healthy as a whole food
   * (exempt from “don’t count fruit/veg inside composites”).
   */
  healthyProcessed?: boolean;
}

/** Fresh produce + staples that define healthy/unhealthy/neutral matching */
export const PRODUCT_CATALOG: CatalogEntry[] = [
  // ── Fruits ──────────────────────────────────────────────────────────
  { id: "elma", category: "healthy", fruitVegGrams: 180, aliases: ["elma starking", "elma granny smith", "elma granny", "apple"] },
  { id: "muz", category: "healthy", fruitVegGrams: 120, aliases: ["banana"] },
  { id: "portakal", category: "healthy", fruitVegGrams: 200, aliases: ["orange"] },
  { id: "limon", category: "healthy", fruitVegGrams: 80, aliases: ["lumon"] },
  { id: "cilek", category: "healthy", fruitVegGrams: 100, aliases: ["strawberry"] },
  { id: "uzum", category: "healthy", fruitVegGrams: 100, aliases: ["grape"] },
  { id: "karpuz", category: "healthy", fruitVegGrams: 300 },
  { id: "kavun", category: "healthy", fruitVegGrams: 250 },
  { id: "seftali", category: "healthy", fruitVegGrams: 150, aliases: ["seftall", "seftal"] },
  { id: "kayisi", category: "healthy", fruitVegGrams: 80 },
  { id: "kiraz", category: "healthy", fruitVegGrams: 100 },
  { id: "visne", category: "healthy", fruitVegGrams: 80 },
  { id: "erik", category: "healthy", fruitVegGrams: 80 },
  { id: "incir", category: "healthy", fruitVegGrams: 60 },
  { id: "nar", category: "healthy", fruitVegGrams: 200 },
  { id: "mandalina", category: "healthy", fruitVegGrams: 100 },
  { id: "armut", category: "healthy", fruitVegGrams: 160, aliases: ["armut deveci", "armut santa maria"] },
  { id: "avokado", category: "healthy", fruitVegGrams: 150, aliases: ["avocado"] },

  // ── Vegetables ──────────────────────────────────────────────────────
  { id: "domates", category: "healthy", fruitVegGrams: 100, aliases: ["donates", "tomato"] },
  { id: "salatalik", category: "healthy", fruitVegGrams: 100, aliases: ["salalik"] },
  { id: "biber", category: "healthy", fruitVegGrams: 100, aliases: ["biber carliston", "biber dolmalik", "biber sivri"] },
  { id: "patates", category: "healthy", fruitVegGrams: 150 },
  { id: "sogan", category: "healthy", fruitVegGrams: 80 },
  { id: "sarimsak", category: "healthy" },
  { id: "havuc", category: "healthy", fruitVegGrams: 60, aliases: ["carrot"] },
  { id: "ispanak", category: "healthy", fruitVegGrams: 30, aliases: ["spinach"] },
  { id: "maydanoz", category: "healthy", fruitVegGrams: 30 },
  { id: "dereotu", category: "healthy", fruitVegGrams: 20 },
  { id: "nane", category: "healthy", fruitVegGrams: 10 },
  { id: "roka", category: "healthy", fruitVegGrams: 30 },
  { id: "marul", category: "healthy", fruitVegGrams: 100, aliases: ["lettuce"] },
  { id: "lahana", category: "healthy", fruitVegGrams: 200 },
  { id: "kabak", category: "healthy", fruitVegGrams: 200 },
  { id: "patlican", category: "healthy", fruitVegGrams: 200 },
  { id: "brokoli", category: "healthy", fruitVegGrams: 150, aliases: ["broccoli"] },
  { id: "karnabahar", category: "healthy" },
  { id: "turp", category: "healthy", fruitVegGrams: 50 },
  { id: "pirasa", category: "healthy", fruitVegGrams: 150 },
  { id: "kereviz", category: "healthy", fruitVegGrams: 100 },
  { id: "enginar", category: "healthy" },
  { id: "bamya", category: "healthy", fruitVegGrams: 100 },
  { id: "bezelye", category: "healthy", fruitVegGrams: 100 },
  { id: "semizotu", category: "healthy" },
  { id: "fasulye", category: "healthy", aliases: ["fasulye taze", "beans"] },
  { id: "barbunya", category: "healthy", aliases: ["barbunya taze"] },

  // ── Protein ─────────────────────────────────────────────────────────
  {
    id: "tavuk",
    category: "healthy",
    aliases: [
      "tavuk but", "tavuk gogus", "tavuk kanat", "butun tavuk", "tavuk baget",
      "chicken", "chicken breast", "turkey",
    ],
  },
  { id: "balik", category: "healthy", aliases: ["fish"] },
  { id: "ton", category: "healthy" },
  { id: "somon", category: "healthy", aliases: ["salmon"] },
  { id: "levrek", category: "healthy" },
  { id: "cipura", category: "healthy" },
  { id: "hamsi", category: "healthy" },
  { id: "sardalya", category: "healthy" },
  { id: "dana", category: "healthy", aliases: ["dana kiyma", "dana kusbasi", "dana bonfile", "dana antrikot"] },
  { id: "kuzu", category: "healthy", aliases: ["kuzu kiyma", "kuzu pirzola"] },
  { id: "yumurta", category: "healthy", healthyProcessed: true, aliases: ["egg"] },

  // ── Dairy / drinks (healthy processed) ──────────────────────────────
  {
    id: "sut",
    category: "healthy",
    healthyProcessed: true,
    aliases: ["sut yagli", "sut yarim yagli", "sut yagli 1 l", "milk"],
  },
  { id: "yogurt", category: "healthy", healthyProcessed: true, aliases: ["yogurt"] },
  { id: "ayran", category: "healthy", healthyProcessed: true },
  { id: "kefir", category: "healthy", healthyProcessed: true },
  { id: "lor", category: "healthy", healthyProcessed: true },
  { id: "peynir", category: "healthy", healthyProcessed: true },
  { id: "tulum", category: "healthy", healthyProcessed: true },
  { id: "cay", category: "healthy", healthyProcessed: true, aliases: ["cay turkak", "cay caykur", "green tea"] },
  { id: "su", category: "healthy", healthyProcessed: true, aliases: ["water", "maden suyu"] },

  // ── Grains / legumes / nuts / other healthy ─────────────────────────
  { id: "mercimek", category: "healthy", aliases: ["lentil"] },
  { id: "nohut", category: "healthy" },
  { id: "bulgur", category: "healthy" },
  { id: "yulaf", category: "healthy", aliases: ["oat"] },
  { id: "pirinc", category: "healthy", aliases: ["brown rice", "rice"] },
  { id: "tam bugday", category: "healthy" },
  { id: "siyez", category: "healthy" },
  { id: "kinoa", category: "healthy", aliases: ["quinoa"] },
  { id: "ceviz", category: "healthy", aliases: ["walnut"] },
  { id: "findik", category: "healthy" },
  { id: "badem", category: "healthy", aliases: ["almond"] },
  { id: "antep fistigi", category: "healthy" },
  { id: "yer fistigi", category: "healthy" },
  { id: "kuruyemis", category: "healthy" },
  { id: "fistik", category: "healthy" },
  { id: "kaju", category: "healthy" },
  { id: "zeytinyagi", category: "healthy", healthyProcessed: true, aliases: ["olive oil"] },
  { id: "zeytin", category: "healthy" },
  { id: "bal", category: "healthy" },
  { id: "salata", category: "healthy", aliases: ["salad"] },

  // English umbrella terms (healthy)
  { id: "organic", category: "healthy" },
  { id: "vegetable", category: "healthy" },
  { id: "fruit", category: "healthy" },
  { id: "berry", category: "healthy", fruitVegGrams: 80, aliases: ["blueberry"] },
  { id: "kale", category: "healthy", fruitVegGrams: 30 },

  // ── Unhealthy ───────────────────────────────────────────────────────
  { id: "cikolata", category: "unhealthy", aliases: ["chocolate"] },
  { id: "biskuvi", category: "unhealthy", aliases: ["cookie"] },
  { id: "kek", category: "unhealthy", aliases: ["cake"] },
  { id: "pasta", category: "unhealthy" }, // sweet pastry sense on TR receipts often cakes; also neutral pasta handled separately by makarna
  { id: "gofret", category: "unhealthy", aliases: ["goofret"] },
  { id: "cips", category: "unhealthy", aliases: ["chips"] },
  { id: "seker", category: "unhealthy", aliases: ["seker toz", "candy"] },
  { id: "dondurma", category: "unhealthy", aliases: ["ice cream"] },
  { id: "lokum", category: "unhealthy" },
  { id: "jelibon", category: "unhealthy" },
  { id: "salam", category: "unhealthy" },
  { id: "sosis", category: "unhealthy", aliases: ["sausage", "hot dog"] },
  { id: "sucuk", category: "unhealthy" },
  { id: "pastirma", category: "unhealthy", aliases: ["bacon"] },
  { id: "ketcap", category: "unhealthy" },
  { id: "mayonez", category: "unhealthy" },
  { id: "hazir corba", category: "unhealthy" },
  { id: "hazir yemek", category: "unhealthy" },
  { id: "margarin", category: "unhealthy" },
  { id: "gazoz", category: "unhealthy", aliases: ["soda"] },
  { id: "kolali", category: "unhealthy", aliases: ["cola"] },
  { id: "enerji icecegi", category: "unhealthy", aliases: ["energy drink"] },
  { id: "malt", category: "unhealthy" },
  { id: "kahve ins", category: "unhealthy", aliases: ["3u 1 arada", "3 u 1 arada"] },
  { id: "bar kakao", category: "unhealthy", aliases: ["kakao kapl"] },
  { id: "kizartma", category: "unhealthy", aliases: ["fried"] },
  { id: "cikofte", category: "unhealthy", aliases: ["cig kofte", "kofte"] },
  { id: "pizza", category: "unhealthy", aliases: ["frozen pizza"] },
  { id: "burger", category: "unhealthy", aliases: ["fast food"] },
  { id: "donut", category: "unhealthy" },
  { id: "alcohol", category: "unhealthy" },
  { id: "corn syrup", category: "unhealthy" },

  // ── Neutral staples ─────────────────────────────────────────────────
  { id: "ekmek", category: "neutral", aliases: ["bread"] },
  { id: "makarna", category: "neutral" },
  { id: "eriste", category: "neutral" },
  { id: "un", category: "neutral", aliases: ["bugday unu"] },
  { id: "aycicek", category: "neutral", aliases: ["misir yagi"] },
  { id: "tereyag", category: "neutral" },
  { id: "tuz", category: "neutral" },
  { id: "baharat", category: "neutral", aliases: ["karabiber", "kimyon"] },
  { id: "sirke", category: "neutral" },
  { id: "salca", category: "neutral" },
  { id: "konserve", category: "neutral" },
  { id: "manti", category: "neutral" },
  { id: "borek", category: "neutral" },
  { id: "simit", category: "neutral" },
  { id: "tost", category: "neutral" },
  { id: "sandvic", category: "neutral" },
];

// ─── Derived indexes (built once at module load) ──────────────────────

export const CATALOG_BY_ID = new Map(
  PRODUCT_CATALOG.map((e) => [e.id, e])
);

/** Longest-first [alias|id → canonical id] for resolution */
export const SORTED_ALIAS_ENTRIES: [string, string][] = (() => {
  const pairs: [string, string][] = [];
  for (const entry of PRODUCT_CATALOG) {
    pairs.push([entry.id, entry.id]);
    for (const a of entry.aliases ?? []) {
      pairs.push([a, entry.id]);
    }
  }
  // OCR-only extras not tied to a full catalog row category
  const ocrOnly: [string, string][] = [
    ["lcecek", "icecek"],
    ["haden", "maden"],
    ["nektart", "nektari"],
  ];
  pairs.push(...ocrOnly);
  return pairs.sort(([a], [b]) => b.length - a.length);
})();

export const HEALTHY_KEYWORDS: string[] = PRODUCT_CATALOG
  .filter((e) => e.category === "healthy")
  .flatMap((e) => [e.id, ...(e.aliases ?? [])]);

export const UNHEALTHY_KEYWORDS: string[] = PRODUCT_CATALOG
  .filter((e) => e.category === "unhealthy")
  .flatMap((e) => [e.id, ...(e.aliases ?? [])]);

export const NEUTRAL_KEYWORDS: string[] = PRODUCT_CATALOG
  .filter((e) => e.category === "neutral")
  .flatMap((e) => [e.id, ...(e.aliases ?? [])]);

export const HEALTHY_PROCESSED_KEYWORDS: string[] = PRODUCT_CATALOG
  .filter((e) => e.healthyProcessed)
  .flatMap((e) => [e.id, ...(e.aliases ?? [])]);

/** id → default grams for fresh fruit/veg estimates */
export const FRUIT_VEG_KEYWORDS: Record<string, number> = {};
for (const e of PRODUCT_CATALOG) {
  if (e.fruitVegGrams != null) {
    FRUIT_VEG_KEYWORDS[e.id] = e.fruitVegGrams;
    // OCR alias salalik shares salatalik grams
    for (const a of e.aliases ?? []) {
      if (a === "salalik") FRUIT_VEG_KEYWORDS[a] = e.fruitVegGrams;
    }
  }
}
// Keep salalik explicit (common OCR form of salatalik)
if (FRUIT_VEG_KEYWORDS["salatalik"] && !FRUIT_VEG_KEYWORDS["salalik"]) {
  FRUIT_VEG_KEYWORDS["salalik"] = FRUIT_VEG_KEYWORDS["salatalik"];
}

/**
 * Tokens that indicate a packaged/composite product (no fresh fruit/veg grams).
 * Diacritic variants are covered by normalizeTurkish at match time.
 */
export const PROCESSED_OR_COMPOSITE_KEYWORDS = [
  "suyu", "sut", "sos", "sirke", "recel", "pure",
  "biskuvi", "gofret", "cips", "kek", "pasta", "aroma", "konserve",
  "tursu", "yogurt", "dondurma", "makarna", "pizza", "corba",
  "un", "ekmek", "salca", "seker", "cikolata",
  "goofret", "salam", "sosis", "sucuk", "pastirma",
  "hazir", "bar", "borek", "pogaca", "simit",
  "tost", "sandvic", "durum", "kebap", "doner",
  "kofte", "manti", "eriste", "pilav", "tatli",
  "helva", "pekmez", "tahin", "kaymak", "tereyag",
  "margarin", "yag", "peynir", "lor", "kasar", "krema",
  "ayran", "kefir", "cacik", "meze", "kraker", "kurabiye", "lokum",
  "jelibon", "sakiz", "gazoz", "kola", "cola", "fanta", "sprite",
  "icecek", "limonata", "serbet", "komposto", "hosaf",
  "salamura", "dondurulmus", "kurutulmus",
  "ketcap", "mayonez", "hardal", "tuz", "baharat",
];

/**
 * Brand / cultivar / filler tokens stripped from product names on receipts.
 * Matching is whole-word, case-insensitive.
 */
export const STRIP_NAME_TOKENS = [
  // Packaging
  "PAKET", "POSETLI", "POSET", "POSETE",
  // Common private-label / brand tokens on TR receipts
  "PETEK", "COKCA", "VERA", "BIRSAN", "CAYKUR", "NIMET", "TURKAK",
  "BERONA", "BEYPAZA", "BEYPAZARI", "HEYWELL", "MOLPED", "HOLPED",
  "Pinar", "PINAR", "SEK", "SUTAS", "SÜTAŞ", "ICIM", "İÇİM",
  "ULKER", "ÜLKER", "ETI", "ETİ", "TORKU", "Tadim", "TADIM",
  // Cultivars / grades (not food type)
  "STARKING", "DEVECI", "CARLISTON", "GRANNY", "SMITH", "SANTA", "MARIA",
  "DOLMALIK", "SIVRI",
];

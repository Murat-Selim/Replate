/**
 * Golden tests for Turkish receipt classification.
 * Run: npx tsx scripts/test-classifier.ts
 *
 * Exits with code 1 if any assertion fails.
 */

import {
  classifyFoods,
  cleanProductLine,
  normalizeTurkish,
} from "../server/services/classifier.js";
import { PRODUCT_CATALOG } from "../server/services/product-catalog.js";
import {
  assertUsableOCR,
  isOCRResultUsable,
  MIN_OCR_CONFIDENCE,
  OCRError,
  type OCRResult,
} from "../server/services/ocr.js";

// Simulated OCR lines from a real-style Turkish grocery receipt
const RECEIPT_LINES = [
  "BELGE",
  "ETTN:2b67893b4374d0db3fd9e1948baaed6",
  "SEKER TOZ 2000 G PETEK %01 *87,50",
  "MEZE CIKOFTE 384 G COKCA %01 *32,50",
  "YUMURTA 15LI L 63-72 G %01 *99,00",
  "MARGARIN PAKET 250 G VERA %01 *23,00",
  "PORTAKAL 500 G CAYKUR %01 *45,54",
  "CAY TURKAK 1 L BIRSAN %01 *149,95",
  "SUT YAGLI 1 L BIRSAN %01 *46,00",
  "MAYDANOZ %01 *29,50",
  "BIBER CARLISTON PAKET (300G) %01 *54,50",
  "DOMATES x119,50 TL/kg %01 *51,39",
  "0.430",
  "LIMON %01 *14,43",
  "0.145",
  "BUTUN TAVUK POSETLI x125,00 TL/kg %01 *233,00",
  "1.864",
  "BAR KAKAO KAPL. YER FISTIKLI %01 *8,00",
  "KAHVE INS. KAU 1 ARADA 18 G CAF %01 *5,50",
  "KAHVE INS. 3U 1 ARADA 17.5 G N %01 *12,25",
  "DURULUK FINDIKLI 1 %01 *5,00",
  "BAR KAKAO LAVAS 200 G NIMET %01 *52,00",
  "KAHVE INS. 3U 1 ARADA YER FISTIKLI 4 %01 *8,50",
  "0.630",
  "MUZ x72,50 TL/kg *54,99",
  "0.755",
  "ARMUT DEVECI x99,50 TL/kg *54,74",
  "SALALIK %01 *73,13",
  "0.475",
  "PATATES x21,50 TL/kg *20,04",
  "0.915",
  "ELMA STARKING x109,50 TL/kg *42,51",
  "4",
  "ELMA GRANNY SMITH x1,00 TL/ad *82,67",
  "ALISVERIS POSETI %20 *4,00",
  "ARA TOPLAM",
];

type Category = "healthy" | "unhealthy" | "neutral";

interface Expectation {
  /** Substring of cleaned product name (case-insensitive / Turkish-normalized) */
  nameIncludes: string;
  category: Category;
  /** Optional minimum fruit/veg grams */
  minFruitVegGrams?: number;
  /** Optional exact fruit/veg grams */
  fruitVegGrams?: number;
}

const EXPECTATIONS: Expectation[] = [
  { nameIncludes: "seker", category: "unhealthy" },
  { nameIncludes: "cikofte", category: "unhealthy" },
  { nameIncludes: "yumurta", category: "healthy" }, // cleaned name should be just YUMURTA
  { nameIncludes: "margarin", category: "unhealthy" },
  { nameIncludes: "portakal", category: "healthy", fruitVegGrams: 500 },
  { nameIncludes: "cay", category: "healthy" },
  { nameIncludes: "sut", category: "healthy" },
  { nameIncludes: "maydanoz", category: "healthy" },
  { nameIncludes: "biber", category: "healthy", fruitVegGrams: 300 },
  { nameIncludes: "domates", category: "healthy", fruitVegGrams: 430 },
  { nameIncludes: "limon", category: "healthy", fruitVegGrams: 145 },
  { nameIncludes: "tavuk", category: "healthy" },
  { nameIncludes: "bar kakao", category: "unhealthy" },
  { nameIncludes: "kahve", category: "unhealthy" },
  { nameIncludes: "muz", category: "healthy", fruitVegGrams: 755 },
  { nameIncludes: "armut", category: "healthy" },
  { nameIncludes: "salalik", category: "healthy", fruitVegGrams: 475 },
  { nameIncludes: "patates", category: "healthy", fruitVegGrams: 915 },
  { nameIncludes: "elma", category: "healthy" },
];

let failures = 0;

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`  FAIL: ${message}`);
    failures++;
  } else {
    console.log(`  OK:   ${message}`);
  }
}

function findProduct(
  products: { name: string; category: string; fruitVegGrams: number }[],
  nameIncludes: string
) {
  const needle = normalizeTurkish(nameIncludes);
  return products.find((p) => normalizeTurkish(p.name).includes(needle));
}

async function testNormalizeTurkish() {
  console.log("\n=== normalizeTurkish ===");
  assert(normalizeTurkish("ŞEKER") === "seker", "ŞEKER → seker");
  assert(normalizeTurkish("Ispanak") === "ispanak", "Ispanak → ispanak");
  assert(normalizeTurkish("ÇİLEK") === "cilek", "ÇİLEK → cilek");
  assert(normalizeTurkish("yoğurt") === "yogurt", "yoğurt → yogurt");
}

function testCatalog() {
  console.log("\n=== product catalog ===");
  assert(PRODUCT_CATALOG.length >= 80, `catalog size >= 80 (got ${PRODUCT_CATALOG.length})`);
  const elma = PRODUCT_CATALOG.find((e) => e.id === "elma");
  assert(!!elma && elma.fruitVegGrams === 180, "elma has 180g default");
  assert(elma?.category === "healthy", "elma is healthy");
  const seker = PRODUCT_CATALOG.find((e) => e.id === "seker");
  assert(seker?.category === "unhealthy", "seker is unhealthy");
  const ekmek = PRODUCT_CATALOG.find((e) => e.id === "ekmek");
  assert(ekmek?.category === "neutral", "ekmek is neutral");
}

function testCleanProductLine() {
  console.log("\n=== cleanProductLine ===");
  const egg = cleanProductLine("YUMURTA 15LI L 63-72 G %01 *99,00");
  assert(
    normalizeTurkish(egg.cleaned) === "yumurta",
    `egg cleans to YUMURTA (got "${egg.cleaned}")`
  );
  assert(
    egg.weightGrams === 0,
    `egg size band is not product weight (got ${egg.weightGrams}g)`
  );

  const elma = cleanProductLine("ELMA STARKING x109,50 TL/kg %01 *42,51");
  assert(
    normalizeTurkish(elma.cleaned) === "elma",
    `elma starking cleans to ELMA (got "${elma.cleaned}")`
  );

  const milk = cleanProductLine("SUT YAGLI 1 L BIRSAN %01 *46,00");
  assert(
    normalizeTurkish(milk.cleaned).includes("sut"),
    `sut keeps core name (got "${milk.cleaned}")`
  );
  assert(
    !normalizeTurkish(milk.cleaned).includes("birsan"),
    "brand BIRSAN stripped"
  );
}

function testOCRGates() {
  console.log("\n=== OCR usability gates ===");

  const empty: OCRResult = { fullText: "", lines: [], confidence: 0 };
  assert(!isOCRResultUsable(empty), "empty lines unusable");

  const low: OCRResult = {
    fullText: "a",
    lines: ["ELMA"],
    confidence: MIN_OCR_CONFIDENCE - 0.01,
  };
  assert(!isOCRResultUsable(low), "low confidence unusable");

  const ok: OCRResult = {
    fullText: "ELMA",
    lines: ["ELMA"],
    confidence: 0.9,
  };
  assert(isOCRResultUsable(ok), "good OCR usable");

  try {
    assertUsableOCR(empty);
    assert(false, "assertUsableOCR should throw on empty");
  } catch (e) {
    assert(e instanceof OCRError && e.code === "OCR_EMPTY", "OCR_EMPTY code");
  }
}

async function testReceiptGolden() {
  console.log("\n=== Golden receipt classification ===\n");

  const result = await classifyFoods(RECEIPT_LINES);

  console.log("--- Product Details ---");
  for (const p of result.products) {
    const emoji =
      p.category === "healthy"
        ? "✅"
        : p.category === "unhealthy"
          ? "❌"
          : "⚪";
    console.log(`${emoji} ${p.name} → ${p.category} (${p.fruitVegGrams}g)`);
  }

  console.log("\n--- Assertions ---");
  assert(result.totalItems > 10, `extracted enough products (got ${result.totalItems})`);
  assert(result.healthyItems >= 10, `healthy count >= 10 (got ${result.healthyItems})`);
  assert(result.unhealthyItems >= 4, `unhealthy count >= 4 (got ${result.unhealthyItems})`);
  assert(result.fruitVegGrams >= 2000, `fruit/veg grams >= 2000 (got ${result.fruitVegGrams})`);

  // Bags / totals must not appear
  const bag = findProduct(result.products, "poset");
  assert(!bag, "shopping bag not classified as product");

  // Cleaned egg name should not retain grade noise
  const yumurta = findProduct(result.products, "yumurta");
  assert(
    !!yumurta && normalizeTurkish(yumurta.name) === "yumurta",
    `yumurta cleaned name is exactly "yumurta" (got "${yumurta?.name}")`
  );

  for (const exp of EXPECTATIONS) {
    const p = findProduct(result.products, exp.nameIncludes);
    if (!p) {
      assert(false, `product matching "${exp.nameIncludes}" exists`);
      continue;
    }
    assert(
      p.category === exp.category,
      `"${p.name}" category is ${exp.category} (got ${p.category})`
    );
    if (exp.fruitVegGrams !== undefined) {
      assert(
        p.fruitVegGrams === exp.fruitVegGrams,
        `"${p.name}" fruitVegGrams === ${exp.fruitVegGrams} (got ${p.fruitVegGrams})`
      );
    }
    if (exp.minFruitVegGrams !== undefined) {
      assert(
        p.fruitVegGrams >= exp.minFruitVegGrams,
        `"${p.name}" fruitVegGrams >= ${exp.minFruitVegGrams} (got ${p.fruitVegGrams})`
      );
    }
  }

  // Diacritic / OCR alias: ŞEKER-style should still be unhealthy via normalize
  const sekerOnly = await classifyFoods(["ŞEKER TOZ 1 KG %01 *10,00"]);
  const sekerProd = sekerOnly.products[0];
  assert(
    !!sekerProd && sekerProd.category === "unhealthy",
    "ŞEKER TOZ classified unhealthy via normalizeTurkish"
  );

  // Adet quantity: 2 apples by piece should estimate ~360g
  const adet = await classifyFoods(["ELMA GRANNY SMITH x2,00 TL/ad *40,00"]);
  const elma = adet.products.find((p) =>
    normalizeTurkish(p.name).includes("elma")
  );
  assert(
    !!elma && elma.fruitVegGrams >= 300,
    `adet x2 elma estimates multi-piece grams (got ${elma?.fruitVegGrams ?? 0})`
  );

  // Neutral staple
  const bread = await classifyFoods(["EKMEK BEYAZ 500 G %01 *15,00"]);
  assert(
    bread.products[0]?.category === "neutral",
    `ekmek is neutral (got ${bread.products[0]?.category})`
  );
}

async function main() {
  console.log("=== Replate classifier / OCR golden tests ===");
  await testNormalizeTurkish();
  testCatalog();
  testCleanProductLine();
  testOCRGates();
  await testReceiptGolden();

  console.log("\n=== SUMMARY ===");
  if (failures > 0) {
    console.error(`\n${failures} assertion(s) failed`);
    process.exit(1);
  }
  console.log("\nAll assertions passed");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

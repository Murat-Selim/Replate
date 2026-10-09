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
import { extractReceiptMetadata } from "../server/services/receipt-metadata.js";
import { getSpendingCategory } from "../server/services/spending-categories.js";
import { normalizeProduct } from "../server/services/product-normalization.js";
import type { protos } from "@google-cloud/vision";
import { readFileSync } from "node:fs";
import {
  assertUsableOCR,
  isOCRResultUsable,
  MIN_OCR_CONFIDENCE,
  OCRError,
  reconstructReceiptLines,
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

  const decimalKg = cleanProductLine("0.85 KG DOMATES %01 *42,50");
  assert(
    decimalKg.weightGrams === 850 && normalizeTurkish(decimalKg.cleaned) === "domates",
    `0.85 KG converts to 850g (got ${decimalKg.weightGrams}g / "${decimalKg.cleaned}")`
  );

  const commaKg = cleanProductLine("0,85 kg DOMATES %01 *42,50");
  assert(commaKg.weightGrams === 850, `0,85 kg converts to 850g (got ${commaKg.weightGrams}g)`);

  const gramWeight = cleanProductLine("710gram DOMATES");
  assert(
    gramWeight.weightGrams === 710 && normalizeTurkish(gramWeight.cleaned) === "domates",
    `710gram converts to 710g (got ${gramWeight.weightGrams}g / "${gramWeight.cleaned}")`
  );
}

async function testPaidPriceExtraction() {
  console.log("\n=== paid price extraction ===");
  const inline = await classifyFoods(["ELMA STARKING %01 *42,51"]);
  assert(inline.products[0]?.paidPrice === 42.51, `inline receipt price is captured (got ${inline.products[0]?.paidPrice})`);

  const split = await classifyFoods(["ELMA STARKING", "*42,51"]);
  assert(split.products[0]?.paidPrice === 42.51, `split receipt price is captured (got ${split.products[0]?.paidPrice})`);

  const currency = await classifyFoods(["Bananas", "S$2.40"]);
  assert(currency.products[0]?.paidPrice === 2.4, `currency receipt price is captured (got ${currency.products[0]?.paidPrice})`);

  const volume = await classifyFoods(["PEPSI 1.25 L", "%08", "*4,70"]);
  assert(volume.products[0]?.paidPrice === 4.7, "package volume is not used as the paid price");

  const before = await classifyFoods(["%01", "*42,25", "PATLICAN", "%01", "*26,47", "SALATALIK"]);
  assert(before.products[0]?.paidPrice === 42.25 && before.products[1]?.paidPrice === 26.47,
    "prices before product names stay attached to the right items");

  const reused = await classifyFoods(["ELMA", "%01", "*10,00", "PATATES"]);
  assert(reused.products[0]?.paidPrice === 10 && reused.products[1]?.paidPrice === undefined,
    "a split price cannot be assigned to two products");

  const inlineThenBefore = await classifyFoods(["ELMA *10,00", "*20,00", "PATATES"]);
  assert(inlineThenBefore.products[0]?.paidPrice === 10 && inlineThenBefore.products[1]?.paidPrice === 20,
    "an inline price does not consume the next product's price");
}

async function testReceiptSpending() {
  console.log("\n=== A101 receipt spending regression ===");
  // Transcribed from the user's photo; these are offline inputs, not a fresh Vision response.
  const items: Array<[string, number, string]> = [
    ["BEBE BİSKÜVİSİ 172 G BEBEBİS", 29.5, "%01"],
    ["TEMİZLİK BEZİ 5Lİ CLEANUNI", 40, "%10"],
    ["EKMEK", 45, "%01"],
    ["PATATES", 37.92, "%01"],
    ["ŞEKER TOZ 1000 G NAR", 52.5, "%01"],
    ["MEYVELİ İÇECEK EKŞİ ELMA 1 L", 55, "%10"],
    ["BAR KAKAO KAPL. YER FISTIKLI 4", 8.5, "%01"],
    ["DOND. MAX GÖKKUŞAĞI ÇATPAT 62", 15, "%01"],
    ["DOND. MAX GÖKKUŞAĞI ÇATPAT 62", 15, "%01"],
    ["KEK ÇİLEK DOLGULU 45 G KEKSPIR", 9.5, "%01"],
    ["BAR KAKAO KAPL. YER FISTIKLI 4", 8.5, "%01"],
    ["MADEN SUYU SADE 200 ML BEYPAZARI", 12, "%01"],
  ];
  for (const layout of ["inline", "after", "before"] as const) {
    const lines = items.flatMap(([name, amount, tax]) => {
      const price = `*${amount.toFixed(2).replace(".", ",")}`;
      return layout === "inline" ? [`${name} ${tax} ${price}`] : layout === "after" ? [name, tax, price] : [tax, price, name];
    });
    const result = await classifyFoods(lines);
    const sum = result.products.reduce((total, product) => total + (product.paidPrice ?? 0), 0);
    const categories: Record<string, number> = {};
    for (const product of result.products) {
      const category = getSpendingCategory(product.name, product.category === "excluded");
      categories[category] = Number(((categories[category] || 0) + (product.paidPrice ?? 0)).toFixed(2));
    }
    assert(result.products.length === 12 && Math.abs(sum - 328.42) < 0.001,
      `${layout} layout captures all 12 prices totaling 328.42 TRY (got ${result.products.length}/${sum})`);
    assert(result.excludedItems === 1, `${layout} cleaning wipes are excluded from nutrition scoring`);
    assert(JSON.stringify(categories) === JSON.stringify({ snacks: 56, household: 40, bakery: 45, produce: 37.92, pantry: 52.5, drinks: 67, frozen: 30 }),
      `${layout} layout has the expected 7 spending categories (got ${JSON.stringify(categories)})`);
  }
  const quantity = await classifyFoods(["3", "x15,00 TL/ad", "EKMEK", "%01", "*45,00"]);
  assert(quantity.products[0]?.quantity === 3 && quantity.products[0]?.paidPrice === 45,
    "split bread quantity and paid price are both captured");
  const metadata = extractReceiptMetadata(["A101", "TL", "ARA TOPLAN *328,42", "MAL/HİZMET TOPLAM TUTARI *317,47", "TOPKDV *10,95", "ÖDENECEK TUTAR", "*328,42"], []);
  assert(metadata.totalSpent === 328.42 && metadata.totalSpentSource === "receipt_total", "split payable total is read as 328.42");
  const subtotal = extractReceiptMetadata(["ARA TOPLAM", "*958,79", "TOPKDV *28,99"], []);
  assert(subtotal.totalSpent === null, "a Turkish subtotal cannot replace a missing final receipt total");
  const fallback = extractReceiptMetadata(["ÖDENECEK TUTAR", "unreadable", "TOPLAM *328,42"], []);
  assert(fallback.totalSpent === 328.42, "unreadable preferred label does not hide a valid total");
  const taxOnly = extractReceiptMetadata(["TOPLAM KDV *10,95"], []);
  assert(taxOnly.totalSpent === null, "VAT total cannot be used as the receipt total");
  for (const [name, expected] of [["ERİK MÜRDÜM", "produce"], ["PORTAKAL", "produce"], ["DOMATES RENDESİ", "pantry"], ["REÇEL ÇEŞİTLERİ", "pantry"], ["BUL. SUN. RENKLİ KONFOR", "household"], ["KANEPE BURGER NİMET", "bakery"]]) {
    assert(getSpendingCategory(name) === expected, `${name} maps to ${expected}`);
  }
}

async function testDollarReceipt() {
  console.log("\n=== Farmer's Table dollar receipt ===");
  // Screenshot transcription; tests parsing without contacting Vision or a payment service.
  const items: Array<[string, number]> = [
    ["Chicken", 4.5], ["Quick Oats", 3.79], ["Olive Oil & Vinegar", 3.99],
    ["Bean (Green) .370 kg @ $4.39/kg", 1.62], ["Onion", 1.39],
    ["Lemon Regular 1@ 3/$2.50", 0.84], ["Peanut Butter", 4.88],
  ];
  for (const layout of ["inline", "after", "before"] as const) {
    const lines = ["Farmer's Table", "1500 First Avenue, Oshawa, ON", "Tel 555-739-7199",
      ...items.flatMap(([name, price]) => {
        const money = "$" + price.toFixed(2);
        return layout === "inline" ? [`${name} ${money}`] : layout === "after" ? [name, money] : [money, name];
      }),
      "SUB TOTAL", "$21.01", "Debit Card", "$21.01", "TOTAL", "$21.01",
      "RESULT APPROVED", "DATE/TIME SEP 23 2014 15:22:30", "TERM ID FE01OD03", "SEQUENCE # 59500100161",
    ];
    const result = await classifyFoods(lines);
    const metadata = extractReceiptMetadata(lines, result.products);
    assert(result.detectedItems === 7 && JSON.stringify(result.products.map((product) => product.paidPrice)) === JSON.stringify(items.map(([, price]) => price)),
      `${layout} dollar receipt has exactly 7 priced products, without subtotal or debit payment rows`);
    assert(metadata.totalSpent === 21.01 && metadata.totalSpentSource === "receipt_total",
      `${layout} dollar receipt keeps the printed total of 21.01`);
    assert(result.products[3]?.actualWeightGrams === 370 && result.products[5]?.paidPrice === 0.84,
      `${layout} bean weight and lemon paid price are preserved`);
    assert(!/[$@]|\bkg\b/i.test(result.products[3]?.name ?? ""), `${layout} unit price text is removed from the product name`);
    assert(JSON.stringify(result.products.map((product) => getSpendingCategory(product.name))) === JSON.stringify(["meat", "pantry", "pantry", "produce", "produce", "produce", "pantry"]),
      `${layout} dollar receipt maps its products to meat, pantry and produce`);
  }
  const unitOnly = await classifyFoods(["Lemon Regular 1@ 3/$2.50"]);
  assert(unitOnly.products[0]?.paidPrice === undefined, "a promotion price cannot substitute for a missing line total");
  const footer = await classifyFoods(["SUB TOTAL $21.01", "Debit Card $21.01", "TOTAL $21.01", "RESULT APPROVED $21.01"]);
  assert(footer.detectedItems === 0, "inline subtotal and debit payment amounts cannot become products");
  const amountBeforeTotal = extractReceiptMetadata(["SUB TOTAL $18.00", "Debit Card", "$ 21.01", "TOTAL", "RESULT APPROVED"], []);
  assert(amountBeforeTotal.totalSpent === 21.01 && amountBeforeTotal.totalSpentSource === "receipt_total",
    "a final total above its label takes priority over the subtotal");
  const missingFinalTotal = extractReceiptMetadata(["SUB TOTAL $18.00", "TAX $3.01", "TOTAL", "RESULT APPROVED"], []);
  assert(missingFinalTotal.totalSpent === null, "a subtotal cannot replace an unreadable final total on an English receipt");
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

async function testInvoiceLayout() {
  console.log("\n=== Invoice OCR column reconstruction ===");
  // Photo transcription with simulated Vision boxes, not a fresh OCR response.
  const cells: Array<[string, number, number]> = [
    ["IRMAKLAR GIDA", 40, 30], ["FATURA TARİHİ 20/08/2026", 40, 60],
    ["ÜRÜNADI", 40, 150], ["MİKTAR", 340, 150], ["BRM", 400, 150],
    ["KDV", 490, 150], ["FİYAT", 560, 150], ["TUTAR", 650, 150],
    ["AYCAN TANDIR LAVAŞ 5'Lİ", 40, 200], ["1", 340, 200], ["ADET", 400, 200],
    ["1", 490, 200], ["55.00", 560, 200], ["55.00", 650, 200], ["2050000017230", 40, 225],
    ["M BİBER CARLİSTON", 40, 270], ["0.4", 340, 270], ["KİLO", 400, 270],
    ["1", 490, 270], ["49.99", 560, 270], ["20.00", 650, 270], ["2703215", 40, 295],
    ["M DOMATES PETEMEK", 40, 340], ["0.83", 340, 340], ["KİLO", 400, 340],
    ["1", 490, 340], ["19.99", 560, 340], ["16.59", 650, 340], ["2703247", 40, 365],
    ["KDV:", 490, 395], ["0.91", 650, 395], ["TOPLAM:", 490, 425], ["91.59", 650, 425],
    ["ÖDEME", 490, 460], ["91.59", 650, 460], ["PARA ÜSTÜ", 490, 490], ["0.00", 650, 490],
    ["YAZI İLE: DOKSANBİR TL", 40, 540], ["HALK BANKASI", 40, 580], ["91.59", 650, 580],
  ];
  const raw = cells.slice().sort((a, b) => a[1] - b[1] || a[2] - b[2]).map(([text]) => text);
  for (const degrees of [0, -8, 90]) {
    const angle = degrees * Math.PI / 180;
    const words = cells.flatMap(([text, startX, y]) => {
      let x = startX;
      return text.split(" ").map((token) => {
        const width = token.length * 6;
        const vertices = [[x, y], [x + width, y], [x + width, y + 14], [x, y + 14]].map(([vx, vy]) => ({
          x: vx * Math.cos(angle) - vy * Math.sin(angle) + 800,
          y: vx * Math.sin(angle) + vy * Math.cos(angle) + 800,
        }));
        x += width + 5;
        return { boundingBox: { vertices }, symbols: [...token].map((symbol) => ({ text: symbol })) };
      });
    }).sort((a, b) => a.boundingBox.vertices[0].x - b.boundingBox.vertices[0].x);
    const annotation: protos.google.cloud.vision.v1.ITextAnnotation = { pages: [{ blocks: [{ paragraphs: [{ words }] }] }] };
    const lines = reconstructReceiptLines(annotation, raw);
    const result = await classifyFoods(lines);
    const metadata = extractReceiptMetadata(lines, result.products);
    assert(result.detectedItems === 3 && JSON.stringify(result.products.map((product) => product.paidPrice)) === JSON.stringify([55, 20, 16.59]),
      `${degrees}° invoice finds 3 products with line totals, without counting unit prices or payment rows`);
    assert(result.products[1]?.actualWeightGrams === 400 && result.products[2]?.actualWeightGrams === 830,
      `${degrees}° invoice keeps 0.4 and 0.83 kilo quantities`);
    assert(metadata.totalSpent === 91.59 && metadata.currencyCode === "TRY", `${degrees}° invoice reads 91.59 TRY`);
    const categories = result.products.map((product) => getSpendingCategory(product.name));
    assert(JSON.stringify(categories) === JSON.stringify(["bakery", "produce", "produce"]), `${degrees}° invoice maps lavash and fresh vegetables correctly`);
  }
  assert(reconstructReceiptLines(undefined, raw) === raw, "missing geometry preserves the original OCR lines");
  assert(reconstructReceiptLines({ pages: [{ blocks: [{ paragraphs: [{ words: [{ symbols: [{ text: "ELMA" }] }] }] }] }] }, raw) === raw,
    "incomplete geometry cannot discard OCR text");
}

async function testCapturedPriceLayouts() {
  console.log("\n=== Captured Vision price layouts (offline) ===");
  // Actual word boxes, restricted to product/total rows; no address or payment identifiers.
  const layouts = JSON.parse(readFileSync(new URL("../fixtures/receipts/price-layouts.json", import.meta.url), "utf8")) as Array<{
    name: string;
    words: Array<{ text: string; vertices: number[][] }>;
  }>;
  for (const layout of layouts) {
    const expected = layout.name === "a101" ? [29.5, 40, 45, 37.92, 52.5, 55, 8.5, 15, 15, 9.5, 8.5, 12] : [4.5, 3.79, 3.99, 1.62, 1.39, 0.84, 4.88];
    const total = Number(expected.reduce((sum, amount) => sum + amount, 0).toFixed(2));
    for (const degrees of [0, -8, 90]) {
      const angle = degrees * Math.PI / 180;
      const words = layout.words.map((word) => ({
        symbols: [{ text: word.text }],
        boundingBox: { vertices: word.vertices.map(([x, y]) => ({
          x: x * Math.cos(angle) - y * Math.sin(angle) + 4000,
          y: x * Math.sin(angle) + y * Math.cos(angle) + 4000,
        })) },
      }));
      const annotation: protos.google.cloud.vision.v1.ITextAnnotation = { pages: [{ blocks: [{ paragraphs: [{ words }] }] }] };
      const lines = reconstructReceiptLines(annotation, []);
      if (layout.name === "a101") lines.push("ARA TOPLAN *328,42", "TOPKDV *10,95", "ODENECEK TUTAR *328,42", "KDV", "*233,42");
      const result = await classifyFoods(lines);
      const metadata = extractReceiptMetadata(lines, result.products);
      assert(JSON.stringify(result.products.map((product) => product.paidPrice)) === JSON.stringify(expected),
        `${layout.name} ${degrees}° captured layout keeps every price with its product and excludes tax/payment rows`);
      assert(metadata.totalSpentSource === "receipt_total" && metadata.totalSpent === total,
        `${layout.name} ${degrees}° captured layout finds the printed total`);
      if (layout.name === "a101") {
        assert(result.excludedItems === 1 && result.products[2]?.quantity === 3 && result.products[3]?.actualWeightGrams === 960,
          `${degrees}° curved receipt retains household exclusion, bread quantity and potato weight`);
        const categories: Record<string, number> = {};
        for (const product of result.products) {
          const category = getSpendingCategory(product.name, product.category === "excluded");
          categories[category] = Number(((categories[category] ?? 0) + (product.paidPrice ?? 0)).toFixed(2));
        }
        assert(JSON.stringify(categories) === JSON.stringify({ snacks: 56, household: 40, bakery: 45, produce: 37.92, pantry: 52.5, drinks: 67, frozen: 30 }),
          `${degrees}° real OCR product names produce the correct seven spending totals`);
        assert(result.products[5]?.category !== "healthy" && result.products[5]?.fruitVegGrams === 0 && result.fruitVegGrams === 960,
          `${degrees}° fruit-flavored drink cannot count as fresh fruit or add estimated fruit grams`);
      }
    }
  }
}

async function testOcrProductCategories() {
  console.log("\n=== OCR product category corrections ===");
  const cases = [
    ["BEBE BLSKUVLSL 172 G BEBEBLS", "snacks", "unhealthy", "biskuvi"],
    ["BEBE B1SKUV1S1 172 G", "snacks", "unhealthy", "biskuvi"],
    ["NADEN SUYU SADE 200 ML", "drinks", "healthy", "su"],
    ["HADEN SUYU SADE 200 ML", "drinks", "healthy", "su"],
    ["MEYVELL (CECEK EKSL ELMA 1 L", "drinks", "neutral", null],
    ["MEYVELI LCECEK ELMA 1 L", "drinks", "neutral", null],
    ["AROMALI (CECEK UZUM 1 L", "drinks", "neutral", null],
  ] as const;
  for (const [name, spending, nutrition, canonicalKey] of cases) {
    const result = await classifyFoods([`${name} %01 *12,00`]);
    const product = result.products[0];
    assert(result.detectedItems === 1 && product?.paidPrice === 12, `${name}: correction preserves the line and price`);
    assert(getSpendingCategory(product?.name ?? "") === spending && getSpendingCategory(name) === spending,
      `${name}: both raw and cleaned names map to ${spending}`);
    assert(product?.category === nutrition && product?.fruitVegGrams === 0, `${name}: nutrition is ${nutrition}, without fresh fruit grams`);
    const normalized = normalizeProduct(product?.name ?? "", product?.category ?? "neutral");
    assert(canonicalKey ? normalized.canonicalKey === canonicalKey : normalized.canonicalKey?.startsWith("item:") === true,
      `${name}: canonical normalization agrees with the classified product`);
  }
  assert(getSpendingCategory("ELMA STARKING") === "produce", "fresh apples remain produce");
  assert(getSpendingCategory("NADEN MARKA XYZ") === "other", "an ambiguous brand cannot be corrected into mineral water");
  assert(getSpendingCategory("ORNEK URUN XYZ") === "other", "unknown product names keep the Other fallback");
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

  // Bags are spending items but must not affect the nutrition score.
  const bag = findProduct(result.products, "poset");
  const excludedBag = result.products.find((product) => normalizeTurkish(product.name).includes("alisveris"));
  assert((bag || excludedBag)?.category === "excluded", "shopping bag is captured and excluded from scoring");

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

  const nonFood = await classifyFoods(["MISTRAL DELUXE 6 K.H %18 *18,50"]);
  assert(
    nonFood.detectedItems === 1 &&
      nonFood.totalItems === 0 &&
      nonFood.products[0]?.category === "excluded",
    "non-food item is detected but excluded from scoring"
  );

  const newMarketReceipt = await classifyFoods([
    "1.285 x39,90 TL/kg", "PATATES",
    "1.125 x39,90 TL/kg", "SOGAN",
    "BEYAZ PEYNIR SUZME 500 G PEYNEX01 *119,00",
    "MADEN SUYU SADE 200 ML BEYPAZARI *11,00",
    "AROMALI ICECEK UZUM 1 L JUSS x10 *55,00",
    "MAYONEZ 550 G BURCU *95,00",
    "DURUMLUK LAVAS 200 G NIMET", "%01", "*49,95",
    "0.620 x104,90 TL/kg", "MUZ ITHAL *65,04",
    "6.715", "x44,90 TL/kg", "DOMATES", "%01", "*32,10",
    "GARNITUR 560 G COKCA *44,50",
    "DOND. CORNETTO CLASSICO KIMY *50,00",
    "SALAH PLLLC 250 G KESKINOGLU",
    "0.590 x59,50 TL/kg", "*01", "*49,50", "ERIK HURDUM", "X01", "*35,11",
    "DLS MAC. 100 ML CKK SIGNAL", "*10", "*32,50",
    "KETCAP TATLI 250 G COKCA *29,50",
    "2", "*16,95 L/4", "ACHA / POGACA 80 G NIMET", "*01", "*33,90",
    "2", "*8,50 TL/ed", "BAR KAKAO KAPL. YER FISTIKLI 4X01",
    "CLFT ACIALI HAZNELL KALEATRAS *10", "*17,00", "*29,50",
  ]);
  assert(
    newMarketReceipt.detectedItems === 18 &&
      newMarketReceipt.totalItems === 16 &&
      newMarketReceipt.excludedItems === 2 &&
      newMarketReceipt.fruitVegGrams === 4335,
    "new market receipt keeps food totals and excludes non-food (got " +
      newMarketReceipt.detectedItems + "/" + newMarketReceipt.totalItems + "/" +
      newMarketReceipt.excludedItems + "/" + newMarketReceipt.fruitVegGrams + "g)"
  );

  // Neutral staple
  const bread = await classifyFoods(["EKMEK BEYAZ 500 G %01 *15,00"]);
  assert(
    bread.products[0]?.category === "neutral",
    `ekmek is neutral (got ${bread.products[0]?.category})`
  );

  const icedTea = await classifyFoods(["LIPTON SEFTALI 330ML %10 *48,95"]);
  assert(
    icedTea.products[0]?.category === "unhealthy" &&
      icedTea.products[0]?.fruitVegGrams === 0,
    `peach iced tea is unhealthy with 0 fruit/veg grams (got ${icedTea.products[0]?.category}/${icedTea.products[0]?.fruitVegGrams}g)`
  );

  const receiptNoise = await classifyFoods(["30 T8 *125,00"]);
  assert(
    receiptNoise.totalItems === 0,
    "price-table code noise is not classified as a product"
  );

  const migrosPhoto = await classifyFoods([
    "2.610 KG x 59,90 TL/KG",
    "DOMATES KG.",
    "0.555 KG x 39,95 TL/KG",
    "SOGAN KURU KG",
    "0.575 KG x 99,95 TL/KG",
    "KOY BIBERI",
    "10 AD x 19,50 TL/AD",
    "SOFRA EKMEK ADET",
    "MARLBORO TBLUE PAKET %0",
    "#979236******4114 ORTAK POS *555,98",
  ]);
  assert(
    migrosPhoto.totalItems === 4 &&
      migrosPhoto.healthyItems === 3 &&
      migrosPhoto.excludedItems === 1 &&
      migrosPhoto.fruitVegGrams === 3740,
    `Migros OCR unit/weight handling is correct (got ${migrosPhoto.totalItems}/${migrosPhoto.healthyItems}/${migrosPhoto.excludedItems}/${migrosPhoto.fruitVegGrams}g)`
  );

  const a101Photo = await classifyFoods([
    "0.710",
    "x59,50 TL/kg",
    "%01",
    "*42,25",
    "PATLICAN",
    "0.670",
    "x39,50 TL/kg",
    "SALATALIK",
    "%01",
    "*26,47",
    "0.515",
    "x49,50 TL/kg",
    "DOMATES",
    "%01",
    "*25,49",
  ]);
  assert(
    a101Photo.fruitVegGrams === 1895,
    `A101 unit price lines keep 710g + 670g + 515g (got ${a101Photo.fruitVegGrams}g)`
  );

  const marketPhoto = await classifyFoods([
    "0,310 kg X 69,00", "M BIBER KOY KG",
    "6,245 kg X 12,90", "M KARPUZ KG",
    "1,156 kg X 59,00", "M UZUM CEKIRDEK",
    "0,772 kg X 49,00", "M SALATALIK KG",
    "0,098 kg X 119,00", "M LIMON KG",
    "0,724 kg X 45,00", "M DOMATES KG",
    "0,822 kg X 59,00", "M PATLICAN KEME",
  ]);
  assert(
    marketPhoto.fruitVegGrams === 10127,
    `market receipt keeps OCR weights (got ${marketPhoto.fruitVegGrams}g)`
  );

  const processedA101 = await classifyFoods([
    "MEYVE NEKTARI KARISIK 1 L CAPP%10 *69,50",
    "DOND. TWISTER OCEAN 65 ML ALG%01 *15,00",
    "BAR KAKAO KAPL. YER FISTIKLI 4%01 *8,50",
  ]);
  assert(
    processedA101.unhealthyItems === 3,
    `A101 nectar, ice cream and cocoa bar are unhealthy (got ${processedA101.unhealthyItems})`
  );

  const splitEnglishReceipt = await classifyFoods([
    "Order #483723",
    "November 12, 2025",
    "Thank you!",
    "Bananas (1kg)", "S$2.40", "x1",
    "Farm Fresh Milk", "S$3.20", "x1",
    "Wholegrain Bread", "S$2.80", "x1",
    "Eggs (10 pcs)", "S$3.50", "x1",
    "Toilet Paper (6 rolls)", "S$4.90",
    "Subtotal", "S$16.80",
    "Shopping Bag", "S$0.10",
    "Tax", "S$1.51",
    "Total", "S$18.41",
  ]);
  assert(
    splitEnglishReceipt.totalItems === 4 &&
      splitEnglishReceipt.detectedItems === 6 &&
      splitEnglishReceipt.excludedItems === 2 &&
      splitEnglishReceipt.healthyItems === 3 &&
      splitEnglishReceipt.fruitVegGrams === 1000,
    `split English receipt parsing is correct (got ${splitEnglishReceipt.detectedItems}/${splitEnglishReceipt.totalItems}/${splitEnglishReceipt.healthyItems}/${splitEnglishReceipt.fruitVegGrams}g)`
  );

  const paymentNoise = await classifyFoods(["Credit Card USD"]);
  assert(
    paymentNoise.totalItems === 0 && paymentNoise.detectedItems === 0,
    "English card payment text is excluded from product analysis"
  );

  const market2Receipt = await classifyFoods([
    "DATE 06/01/2016",
    "ZUCCHINI GREEN $4.66", "0.778kg NET @ $5.99/kg",
    "BANANA CAVENDISH $1.32", "0.442kg NET @ $2.99/kg",
    "SPECIAL $0.99", "SPECIAL $1.50",
    "POTATOES BRUSHED $3.97", "1.328kg NET @ $2.99/kg",
    "BROCCOLI $4.84", "0.808kg NET @ $5.99/kg",
    "BRUSSEL SPROUTS $5.15", "0.322kg NET @ $15.99/kg",
    "SPECIAL $0.99",
    "GRAPES GREEN $7.03", "1.174kg NET @ $5.99/kg",
    "PEAS $3.27", "0.218kg NET @ $14.99/kg",
    "TOMATOES GRAPE $2.99",
    "LETTUCE ICEBERG $2.49",
    "TOTAL $24.20",
  ]);
  assert(
    market2Receipt.totalItems === 9 &&
      market2Receipt.healthyItems === 9 &&
      market2Receipt.fruitVegGrams === 5270,
    `market2 NET weight lines are attached to 9 named products (got ${market2Receipt.totalItems}/${market2Receipt.healthyItems}/${market2Receipt.fruitVegGrams}g)`
  );

  const previousOffApi = process.env.USE_OFF_API;
  process.env.USE_OFF_API = "false";
  const unknownProduct = await classifyFoods(["ORNEK URUN XYZ %01 *12,00"]);
  if (previousOffApi === undefined) delete process.env.USE_OFF_API;
  else process.env.USE_OFF_API = previousOffApi;
  assert(
    unknownProduct.totalItems === 1 &&
      unknownProduct.products[0]?.category === "neutral",
    "unknown products stay in the receipt with a neutral fallback category"
  );
}

async function main() {
  console.log("=== Replate classifier / OCR golden tests ===");
  await testNormalizeTurkish();
  testCatalog();
  testCleanProductLine();
  await testPaidPriceExtraction();
  await testReceiptSpending();
  await testDollarReceipt();
  testOCRGates();
  await testInvoiceLayout();
  await testCapturedPriceLayouts();
  await testOcrProductCategories();
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

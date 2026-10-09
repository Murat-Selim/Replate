/**
 * End-to-end receipt smoke test: image/lines → OCR → classify.
 *
 * Usage:
 *   npm run test:receipt -- --mock
 *   npm run test:receipt -- --lines fixtures/receipts/migros-sample.json
 *   npm run test:receipt -- path/to/receipt.jpg
 *   npm run test:receipt -- path/to/receipt.jpg --save fixtures/receipts/my-run.json
 *   npm run test:receipt -- path/to/receipt.jpg --strict
 *   npm run test:receipt -- path/to/receipt.jpg --diagnose --save .receipt-diagnostics/capture.json
 *
 * Env (from backend/.env):
 *   GOOGLE_CREDENTIALS_JSON=gcloud-key.json   # path or raw JSON
 *   USE_MOCK_OCR=true                          # force mock OCR
 *   USE_OFF_API=true|false
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BACKEND_ROOT = path.resolve(__dirname, "..");

dotenv.config({ path: path.join(BACKEND_ROOT, ".env") });

// Import after dotenv so services see env
const { processOCR, assertUsableOCR, OCRError, reconstructReceiptLines } = await import(
  "../server/services/ocr.js"
);
const { classifyFoods } = await import("../server/services/classifier.js");
const { extractReceiptMetadata } = await import("../server/services/receipt-metadata.js");
const { getSpendingCategory } = await import("../server/services/spending-categories.js");
import type { FoodClassification } from "../server/services/classifier.js";
import type { ReceiptMetadata } from "../server/services/receipt-metadata.js";
import type { OCRResult } from "../server/services/ocr.js";

interface OcrFixture {
  name?: string;
  source?: string;
  confidence?: number;
  fullText?: string;
  lines: string[];
  analysisLines?: string[];
  annotation?: OCRResult["annotation"];
  capturedAt?: string;
  diagnostic?: { raw: E2EResult; analysis: E2EResult };
}

interface E2EResult extends ReceiptMetadata {
  mode: "mock" | "vision" | "lines";
  ocrConfidence: number;
  lineCount: number;
  totalItems: number;
  detectedItems: number;
  healthyItems: number;
  unhealthyItems: number;
  neutralItems: number;
  fruitVegGrams: number;
  pricedItems: number;
  itemizedTotal: number;
  differenceFromPrintedTotal: number | null;
  products: FoodClassification["products"][number][];
}

function parseArgs(argv: string[]) {
  const args = {
    mock: false,
    strict: false,
    diagnose: false,
    linesPath: null as string | null,
    savePath: null as string | null,
    imagePath: null as string | null,
    help: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--mock") args.mock = true;
    else if (a === "--strict") args.strict = true;
    else if (a === "--diagnose") args.diagnose = true;
    else if (a === "--help" || a === "-h") args.help = true;
    else if (a === "--lines") args.linesPath = argv[++i] ?? null;
    else if (a === "--save") args.savePath = argv[++i] ?? null;
    else if (!a.startsWith("-") && !args.imagePath) args.imagePath = a;
  }
  return args;
}

function printHelp() {
  console.log(`
Replate receipt E2E smoke test

  npm run test:receipt -- --mock
  npm run test:receipt -- --lines fixtures/receipts/migros-sample.json
  npm run test:receipt -- ./my-receipt.jpg
  npm run test:receipt -- ./my-receipt.jpg --save fixtures/receipts/capture.json
  npm run test:receipt -- ./my-receipt.jpg --strict

Flags:
  --mock     Force mock OCR (no Vision call)
  --lines F  Skip OCR; classify saved lines JSON
  --save F   Write OCR dump (lines + confidence) to F
  --strict   Exit 1 if zero products or OCR unusable
  --diagnose Compare raw OCR and reconstructed rows, including prices (disables OpenFoodFacts)
  --help     Show this help
`);
}

function resolvePath(p: string): string {
  return path.isAbsolute(p) ? p : path.resolve(process.cwd(), p);
}

function loadLinesFixture(filePath: string): OcrFixture {
  const abs = resolvePath(filePath);
  const data = JSON.parse(fs.readFileSync(abs, "utf8")) as OcrFixture;
  if (!Array.isArray(data.lines) || data.lines.length === 0) {
    throw new Error(`Fixture has no lines: ${abs}`);
  }
  return data;
}

function imageToBase64(filePath: string): string {
  const abs = resolvePath(filePath);
  if (!fs.existsSync(abs)) {
    throw new Error(`Image not found: ${abs}`);
  }
  const buf = fs.readFileSync(abs);
  const ext = path.extname(abs).toLowerCase().replace(".", "") || "jpeg";
  const mime =
    ext === "png"
      ? "image/png"
      : ext === "webp"
        ? "image/webp"
        : ext === "gif"
          ? "image/gif"
          : "image/jpeg";
  return `data:${mime};base64,${buf.toString("base64")}`;
}

function saveFixture(filePath: string, fixture: OcrFixture) {
  const abs = resolvePath(filePath);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, JSON.stringify(fixture, null, 2), "utf8");
  console.log(`\n💾 Saved OCR fixture → ${abs}`);
}

function summarize(mode: E2EResult["mode"], lines: string[], confidence: number, classification: FoodClassification): E2EResult {
  const metadata = extractReceiptMetadata(lines, classification.products);
  const itemizedTotal = Number(classification.products.reduce((sum, product) => sum + (product.paidPrice ?? 0), 0).toFixed(2));
  return {
    ...metadata,
    mode,
    ocrConfidence: confidence,
    lineCount: lines.length,
    totalItems: classification.totalItems,
    detectedItems: classification.detectedItems,
    healthyItems: classification.healthyItems,
    unhealthyItems: classification.unhealthyItems,
    neutralItems: classification.totalItems - classification.healthyItems - classification.unhealthyItems,
    fruitVegGrams: classification.fruitVegGrams,
    pricedItems: classification.products.filter((product) => product.paidPrice !== undefined).length,
    itemizedTotal,
    differenceFromPrintedTotal: metadata.totalSpentSource === "receipt_total" && metadata.totalSpent !== null
      ? Number((itemizedTotal - metadata.totalSpent).toFixed(2)) : null,
    products: classification.products,
  };
}

function printResult(result: E2EResult) {
  console.log("\n========== E2E RESULT ==========");
  console.log(`Mode:          ${result.mode}`);
  console.log(`OCR lines:     ${result.lineCount}`);
  console.log(`OCR conf:      ${result.ocrConfidence.toFixed(3)}`);
  console.log("Food products: " + result.totalItems);
  console.log("Detected:      " + result.detectedItems);
  console.log(`  healthy:     ${result.healthyItems}`);
  console.log(`  unhealthy:   ${result.unhealthyItems}`);
  console.log(`  neutral:     ${result.neutralItems}`);
  console.log(`Fruit/veg g:   ${result.fruitVegGrams}`);
  console.log(`Priced items:  ${result.pricedItems}/${result.detectedItems}`);
  console.log(`Item sum:      ${result.itemizedTotal.toFixed(2)}`);
  console.log(`Receipt total: ${result.totalSpent ?? "unreadable"} (${result.totalSpentSource ?? "unknown"})`);
  console.log(`Difference:    ${result.differenceFromPrintedTotal ?? "no printed total"}`);
  console.log("\n--- Products ---");
  for (const p of result.products) {
    const emoji =
      p.category === "healthy"
        ? "✅"
        : p.category === "unhealthy"
          ? "❌"
          : "⚪";
    console.log(
      `${emoji} ${p.name} → ${p.category} / ${getSpendingCategory(p.name, p.category === "excluded")} (${p.fruitVegGrams}g), price: ${p.paidPrice ?? "MISSING"}`
    );
  }
  console.log("================================\n");
}

async function run(): Promise<number> {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return 0;
  }

  if (args.mock) {
    process.env.USE_MOCK_OCR = "true";
  }
  if (args.diagnose) process.env.USE_OFF_API = "false";

  let mode: E2EResult["mode"] = "mock";
  let lines: string[] = [];
  let rawLines: string[] = [];
  let annotation: OCRResult["annotation"];
  let fullText = "";
  let confidence = 0;

  console.log("=== Replate receipt E2E ===\n");

  if (args.linesPath) {
    mode = "lines";
    const fixture = loadLinesFixture(args.linesPath);
    rawLines = fixture.lines;
    annotation = fixture.annotation;
    lines = annotation ? reconstructReceiptLines(annotation, rawLines) : fixture.analysisLines ?? rawLines;
    fullText = fixture.fullText ?? lines.join("\n");
    confidence = fixture.confidence ?? 0.9;
    console.log(`📄 Loaded ${lines.length} lines from ${args.linesPath}`);
    console.log(`   name: ${fixture.name ?? "(unnamed)"}`);
  } else if (args.imagePath) {
    mode = process.env.USE_MOCK_OCR === "true" ? "mock" : "vision";
    const b64 = imageToBase64(args.imagePath);
    console.log(`🖼️  Image: ${resolvePath(args.imagePath)}`);
    console.log(`   base64 length: ${b64.length}`);
    console.log(`   credentials: ${Boolean(process.env.GOOGLE_CREDENTIALS_JSON || process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON || process.env.GOOGLE_APPLICATION_CREDENTIALS) ? "configured" : "none"}`);
    console.log(`   USE_MOCK_OCR: ${process.env.USE_MOCK_OCR ?? "false"}`);
    console.log("\n⏳ Running OCR...");

    try {
      const ocr = await processOCR(b64);
      rawLines = ocr.lines;
      annotation = ocr.annotation;
      lines = ocr.analysisLines ?? ocr.lines;
      fullText = ocr.fullText;
      confidence = ocr.confidence;
      mode = process.env.USE_MOCK_OCR === "true" ? "mock" : "vision";
      console.log(
        `📝 OCR: ${lines.length} lines, confidence ${confidence.toFixed(3)}`
      );
    } catch (err) {
      console.error("❌ OCR failed:", err instanceof Error ? err.message : err);
      return 1;
    }
  } else if (args.mock) {
    mode = "mock";
    // Minimal valid base64 so validate path is skipped under mock
    const dummy =
      "data:image/jpeg;base64," + Buffer.from("mock-receipt-image").toString("base64");
    const ocr = await processOCR(dummy);
    rawLines = ocr.lines;
    lines = ocr.analysisLines ?? ocr.lines;
    fullText = ocr.fullText;
    confidence = ocr.confidence;
    console.log(`🎭 Mock OCR: ${lines.length} lines`);
  } else {
    // Default: offline fixture if present, else mock
    const defaultFixture = path.join(
      BACKEND_ROOT,
      "fixtures/receipts/migros-sample.json"
    );
    if (fs.existsSync(defaultFixture)) {
      mode = "lines";
      const fixture = loadLinesFixture(defaultFixture);
      rawLines = fixture.lines;
      annotation = fixture.annotation;
      lines = annotation ? reconstructReceiptLines(annotation, rawLines) : fixture.analysisLines ?? rawLines;
      fullText = fixture.fullText ?? lines.join("\n");
      confidence = fixture.confidence ?? 0.9;
      console.log(`📄 Default fixture: ${defaultFixture}`);
    } else {
      printHelp();
      console.error("No image / --lines / --mock provided.");
      return 1;
    }
  }

  // Gate
  try {
    assertUsableOCR({ fullText, lines, confidence });
    console.log("✅ OCR usability gate passed");
  } catch (err) {
    if (err instanceof OCRError) {
      console.error(`❌ OCR gate: [${err.code}] ${err.message}`);
      if (args.strict) return 1;
    } else {
      throw err;
    }
  }

  // Show first OCR lines for debugging real photos
  if (args.diagnose) {
    console.log("\n--- Raw OCR lines ---");
    rawLines.forEach((line, index) => console.log(`${String(index + 1).padStart(3)}| ${line}`));
  }
  console.log("\n--- Reconstructed analysis lines ---");
  lines.slice(0, args.diagnose ? undefined : 40).forEach((line, index) => console.log(`${String(index + 1).padStart(3)}| ${line}`));
  if (!args.diagnose && lines.length > 40) console.log(`... +${lines.length - 40} more`);

  console.log("\n⏳ Classifying...");
  const classification = await classifyFoods(lines);

  const result = summarize(mode, lines, confidence, classification);
  let diagnostic: OcrFixture["diagnostic"];
  if (args.diagnose) {
    const rawClassification = rawLines.join("\n") === lines.join("\n") ? classification : await classifyFoods(rawLines);
    diagnostic = { raw: summarize(mode, rawLines, confidence, rawClassification), analysis: result };
    console.log("\n--- Raw OCR parsing result ---");
    printResult(diagnostic.raw);
    console.log("\n--- Reconstructed row parsing result ---");
  }

  if (args.savePath) {
    saveFixture(args.savePath, {
      name: args.imagePath ? path.basename(args.imagePath) : args.linesPath ? path.basename(args.linesPath) : "mock",
      source: mode,
      confidence,
      fullText,
      lines: rawLines,
      analysisLines: lines,
      annotation,
      capturedAt: new Date().toISOString(),
      diagnostic,
    });
  }

  printResult(result);

  // Soft / strict checks
  let exitCode = 0;
  if (result.totalItems === 0) {
    console.error("⚠️  No products extracted from this receipt.");
    if (args.strict) exitCode = 1;
  } else {
    console.log("✅ Pipeline produced product classifications.");
  }

  // Sanity for known mock / migros-sample fixture
  const isKnownGood =
    mode === "mock" ||
    (args.linesPath && args.linesPath.includes("migros-sample")) ||
    (!args.imagePath && !args.linesPath && mode === "lines");

  if (isKnownGood && result.totalItems > 0) {
    if (result.healthyItems < 5) {
      console.error(
        `⚠️  Expected several healthy items on sample (got ${result.healthyItems})`
      );
      if (args.strict) exitCode = 1;
    } else {
      console.log("✅ Sample receipt sanity checks look good.");
    }
  }

  if (mode === "vision") {
    console.log(
      "💡 Tip: re-run with --save fixtures/receipts/<name>.json to freeze this OCR dump for offline regression."
    );
  }

  return exitCode;
}

run()
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });

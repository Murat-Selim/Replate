import "dotenv/config";
import { mkdirSync, readFileSync, readdirSync, existsSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { ClassificationResult } from "../server/services/classifier.js";
import { readReceiptImage } from "../server/services/receipt-reader.js";
import { assertReliableReceiptAnalysis, type ReceiptAnalysis } from "../server/services/receipt-analysis.js";

// Usage: npm run eval:receipts -- [--runs N] [case-name ...]
// Makes one paid model call per case per run (needs OCR_API_KEY); manual only, never part of npm test.

interface ExpectedItem {
  name: string;
  paidPrice: number;
  quantity: number;
  grams: number;
  excluded: boolean;
  /** Optional model-judgement labels; mismatches are warnings, not failures. */
  health?: "healthy" | "unhealthy" | "neutral";
  alcohol?: boolean;
  fruitVeg?: boolean;
}

interface GoldenCase {
  description?: string;
  image: string;
  currency: string;
  total: number;
  items: ExpectedItem[];
}

interface RunResult {
  run: number;
  ms: number;
  error?: string;
  reliable?: string | true;
  failures: string[];
  warnings: string[];
  /** Per expected item: what this run read for it, used to measure run-to-run consistency. */
  readings: string[];
  fingerprint: string;
  analysis?: ReceiptAnalysis;
}

const GOLDEN_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "../fixtures/golden");
const cents = (value: number) => Math.round(value * 100);
const money = (value: number | null | undefined) => (typeof value === "number" ? value.toFixed(2) : String(value));

const args = process.argv.slice(2);
const runsFlag = args.indexOf("--runs");
const runs = runsFlag >= 0 ? Math.max(1, Number(args[runsFlag + 1]) || 1) : 1;
const only = args.filter((arg, index) => !arg.startsWith("--") && !(runsFlag >= 0 && index === runsFlag + 1));

/** Uppercase ASCII letters and digits only: names are compared for alignment, not character by character. */
function normalizeName(name: string): string {
  return name.replace(/[İı]/g, "I").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function similarity(a: string, b: string): number {
  const x = normalizeName(a);
  const y = normalizeName(b);
  if (!x.length && !y.length) return 1;
  let previous = Array.from({ length: y.length + 1 }, (_, index) => index);
  for (let i = 1; i <= x.length; i++) {
    const current = [i];
    for (let j = 1; j <= y.length; j++) {
      current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + (x[i - 1] === y[j - 1] ? 0 : 1));
    }
    previous = current;
  }
  return 1 - previous[y.length] / Math.max(x.length, y.length);
}

/**
 * Order-preserving alignment of expected and read products by name, so a missing or extra row shows up as one
 * missing/extra product instead of shifting every later comparison.
 */
function align(expected: ExpectedItem[], actual: ClassificationResult[]): Array<number | undefined> {
  const score = (i: number, j: number) => similarity(expected[i].name, actual[j].name) - 0.5;
  const best = Array.from({ length: expected.length + 1 }, () => new Array<number>(actual.length + 1).fill(0));
  for (let i = expected.length - 1; i >= 0; i--) {
    for (let j = actual.length - 1; j >= 0; j--) {
      best[i][j] = Math.max(best[i + 1][j], best[i][j + 1], score(i, j) + best[i + 1][j + 1]);
    }
  }
  const pairs: Array<number | undefined> = expected.map(() => undefined);
  let i = 0;
  let j = 0;
  while (i < expected.length && j < actual.length) {
    if (score(i, j) > 0 && best[i][j] === score(i, j) + best[i + 1][j + 1]) pairs[i++] = j++;
    else if (best[i][j] === best[i + 1][j]) i++;
    else j++;
  }
  return pairs;
}

function compare(golden: GoldenCase, analysis: ReceiptAnalysis): Omit<RunResult, "run" | "ms"> {
  const failures: string[] = [];
  const warnings: string[] = [];
  let reliable: string | true = true;
  try {
    assertReliableReceiptAnalysis(analysis);
  } catch (error) {
    reliable = (error as Error).message;
    failures.push(`reliability check failed: ${reliable}`);
  }
  const { totalSpent, currencyCode } = analysis.metadata;
  if (totalSpent === null || cents(totalSpent) !== cents(golden.total)) failures.push(`total: expected ${money(golden.total)}, got ${money(totalSpent)}`);
  if (currencyCode !== golden.currency) failures.push(`currency: expected ${golden.currency}, got ${currencyCode}`);

  const products = analysis.classification.products;
  if (products.length !== golden.items.length) failures.push(`item count: expected ${golden.items.length}, got ${products.length}`);
  const pairs = align(golden.items, products);
  const readings = golden.items.map((item, index) => {
    const label = `#${index + 1} ${item.name}`;
    const at = pairs[index];
    if (at === undefined) {
      failures.push(`${label}: missing`);
      return "missing";
    }
    const product = products[at];
    const excluded = product.category === "excluded";
    if (cents(product.paidPrice ?? NaN) !== cents(item.paidPrice)) failures.push(`${label}: paidPrice expected ${money(item.paidPrice)}, got ${money(product.paidPrice)}`);
    if (product.quantity !== item.quantity) failures.push(`${label}: quantity expected ${item.quantity}, got ${product.quantity}`);
    if (product.actualWeightGrams !== item.grams) failures.push(`${label}: grams expected ${item.grams}, got ${product.actualWeightGrams}`);
    if (excluded !== item.excluded) failures.push(`${label}: excluded expected ${item.excluded}, got ${excluded} (${product.spendingCategory})`);

    if (similarity(item.name, product.name) < 0.85) warnings.push(`${label}: name read as "${product.name}"`);
    // Alcohol is not exposed on the product; the reader always turns it into "unhealthy".
    if (item.alcohol === true && product.category !== "unhealthy") warnings.push(`${label}: alcohol expected (unhealthy), got ${product.category}`);
    if (item.health && product.category !== item.health) warnings.push(`${label}: health expected ${item.health}, got ${product.category}`);
    if (item.fruitVeg !== undefined && (product.fruitVegGrams > 0) !== item.fruitVeg) {
      warnings.push(`${label}: fruitVeg expected ${item.fruitVeg}, got ${product.fruitVegGrams} g`);
    }
    return `${money(product.paidPrice)} x${product.quantity} ${product.actualWeightGrams}g${excluded ? " excluded" : ""}`;
  });
  products.forEach((product, index) => {
    if (!pairs.includes(index)) failures.push(`extra item: "${product.name}" ${money(product.paidPrice)}`);
  });
  const fingerprint = JSON.stringify([totalSpent, currencyCode, products.map((p) => [p.name, p.paidPrice, p.quantity, p.actualWeightGrams, p.category])]);
  return { reliable, failures, warnings, readings, fingerprint, analysis };
}

function loadCases(): Array<{ name: string; golden: GoldenCase }> {
  const cases = readdirSync(GOLDEN_DIR).filter((file) => file.endsWith(".json")).sort().map((file) => ({
    name: basename(file, ".json"),
    golden: JSON.parse(readFileSync(join(GOLDEN_DIR, file), "utf8")) as GoldenCase,
  })).filter(({ name }) => !only.length || only.includes(name));
  for (const { name, golden } of cases) {
    // A typo in the expectations would otherwise show up as a reader failure.
    const sum = golden.items.reduce((total, item) => total + cents(item.paidPrice), 0);
    if (sum !== cents(golden.total)) throw new Error(`${name}.json: items sum to ${money(sum / 100)}, not the printed total ${money(golden.total)}`);
  }
  return cases;
}

const cases = loadCases();
if (!cases.length) throw new Error(only.length ? `No golden case named ${only.join(", ")}` : `No golden cases in ${GOLDEN_DIR}`);

const summary: Array<{ name: string; passed: number; total: number; meanMs: number; maxMs: number; distinct: number; skipped?: string }> = [];
const saved: Record<string, RunResult[]> = {};
let exactFailure = false;

for (const { name, golden } of cases) {
  const imagePath = join(GOLDEN_DIR, golden.image);
  console.log(`\n=== ${name} (${golden.items.length} items, ${money(golden.total)} ${golden.currency})`);
  if (!existsSync(imagePath)) {
    console.log(`  SKIPPED: image not found at ${imagePath} (see fixtures/golden/README.md)`);
    summary.push({ name, passed: 0, total: 0, meanMs: 0, maxMs: 0, distinct: 0, skipped: "image missing" });
    exactFailure = true;
    continue;
  }
  const image = readFileSync(imagePath).toString("base64");
  const results: RunResult[] = [];
  for (let run = 1; run <= runs; run++) {
    const started = Date.now();
    let result: RunResult;
    try {
      const analysis = await readReceiptImage(image);
      result = { run, ms: Date.now() - started, ...compare(golden, analysis) };
    } catch (error) {
      const message = `${(error as Error).name}: ${(error as Error).message}`;
      result = { run, ms: Date.now() - started, error: message, failures: [`reader threw ${message}`], warnings: [], readings: golden.items.map(() => "error"), fingerprint: `error:${message}` };
    }
    results.push(result);
    const status = result.failures.length ? "FAIL" : "PASS";
    console.log(`  run ${run}: ${status} in ${(result.ms / 1000).toFixed(1)}s | reliable: ${result.reliable === true ? "yes" : "NO"} | total: ${money(result.analysis?.metadata.totalSpent)} | items: ${result.analysis?.classification.products.length ?? "-"}`);
    for (const failure of result.failures) console.log(`    x ${failure}`);
    for (const warning of result.warnings) console.log(`    ~ ${warning}`);
  }

  const distinct = new Set(results.map((result) => result.fingerprint)).size;
  if (runs > 1) {
    console.log(`  consistency: ${distinct === 1 ? "all runs identical" : `${distinct} different readings in ${runs} runs`}`);
    golden.items.forEach((item, index) => {
      const values = [...new Set(results.map((result) => result.readings[index]))];
      if (values.length > 1) console.log(`    unstable #${index + 1} ${item.name}: ${values.join(" | ")}`);
    });
  }
  const passed = results.filter((result) => !result.failures.length).length;
  if (passed < results.length) exactFailure = true;
  const times = results.map((result) => result.ms);
  summary.push({ name, passed, total: results.length, meanMs: times.reduce((a, b) => a + b, 0) / times.length, maxMs: Math.max(...times), distinct });
  saved[name] = results;
}

console.log("\n=== Summary");
for (const row of summary) {
  if (row.skipped) {
    console.log(`  ${row.name.padEnd(16)} SKIPPED (${row.skipped})`);
    continue;
  }
  console.log(`  ${row.name.padEnd(16)} ${row.passed}/${row.total} passed | mean ${(row.meanMs / 1000).toFixed(1)}s, max ${(row.maxMs / 1000).toFixed(1)}s | ${row.distinct === 1 ? "stable" : `${row.distinct} distinct readings`}`);
}
const passedRuns = summary.reduce((sum, row) => sum + row.passed, 0);
const totalRuns = summary.reduce((sum, row) => sum + row.total, 0);
console.log(`  overall: ${passedRuns}/${totalRuns} runs passed`);

// Raw readings stay local (results/ is gitignored) for diffing between prompt versions.
const resultsDir = join(GOLDEN_DIR, "results");
mkdirSync(resultsDir, { recursive: true });
const resultsFile = join(resultsDir, `${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
writeFileSync(resultsFile, JSON.stringify({ runs, summary, results: saved }, null, 2));
console.log(`  raw readings: ${resultsFile}`);

process.exit(exactFailure ? 1 : 0);

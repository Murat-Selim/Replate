import type { ClassificationResult, FoodClassification } from "./classifier.js";
import { OCRError, validateImageBase64 } from "./ocr.js";
import { ReceiptAnalysisError, type ReceiptAnalysis } from "./receipt-analysis.js";
import { SPENDING_CATEGORIES } from "./spending-categories.js";

const MODEL = "Qwen/Qwen3.6-35B-A3B-FP8";
const UNITS = ["piece", "pack", "kg", "g", "l", "ml"] as const;
/** "other" is left out on purpose: every product must be placed, or the receipt cannot be verified. */
const CATEGORIES = SPENDING_CATEGORIES.filter((category) => category !== "other");
const HEALTH = ["healthy", "unhealthy", "neutral"] as const;
const MAX_ITEMS = 200;
/** Default portion when a fruit or vegetable has no printed weight. */
const DEFAULT_FRUIT_VEG_GRAMS = 150;

const nullable = (type: string) => ({ type: [type, "null"] });

/** The model fills this schema; every derived number (paid prices, grams, scores) is computed here. */
export const RECEIPT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["readable", "merchant", "currency", "items", "quantities", "basketDiscount", "subtotal", "addedTax", "total"],
  properties: {
    readable: { type: "boolean" },
    merchant: nullable("string"),
    currency: nullable("string"),
    items: {
      type: "array",
      maxItems: MAX_ITEMS,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "totalPrice", "discount", "category", "health", "alcohol", "fruitVeg"],
        properties: {
          name: { type: "string" },
          totalPrice: { type: "number" },
          discount: { type: "number" },
          category: { type: "string", enum: CATEGORIES },
          health: { type: "string", enum: HEALTH },
          alcohol: { type: "boolean" },
          fruitVeg: { type: "boolean" },
        },
      },
    },
    quantities: {
      type: "array",
      maxItems: MAX_ITEMS,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["quantity", "unit", "unitPrice"],
        properties: {
          quantity: { type: "number" },
          unit: { type: "string", enum: UNITS },
          unitPrice: { type: "number" },
        },
      },
    },
    basketDiscount: { type: "number" },
    subtotal: nullable("number"),
    addedTax: nullable("number"),
    total: nullable("number"),
  },
} as const;

export const RECEIPT_PROMPT = [
  "Read this grocery receipt photo and return JSON that matches the schema.",
  "items: every purchased product in printed order, including repeated products. Never output header, total, tax, payment, change, loyalty, weight/count or informational lines (such as \"2. Fiyat\") as items.",
  "name: the product name exactly as printed; do not translate, expand or correct it.",
  "totalPrice: the amount printed at the right edge of the product's own row, before any discount; never a unit price. Columns such as \"%1\", \"%10\", \"%20\", \"%01\" or \"*08\" are VAT rates, never amounts.",
  "discount: a discount printed for that product (e.g. \"ÜRÜN İND. -25,00\", \"İNDİRİM\", \"Rabatt\", \"Coupon\") as a positive number, otherwise 0. basketDiscount: discounts for the whole receipt that do not belong to one product, as a positive number, otherwise 0.",
  "quantities: every printed weight or count with its unit price, in printed order, whether on its own line or inside a product row: \"0,776 kg X 69,00\" is {quantity 0.776, unit kg, unitPrice 69}, \"2 X 15,00\" is {quantity 2, unit piece, unitPrice 15}, \"x109,50 TL/kg\" with weight 0.755 is {quantity 0.755, unit kg, unitPrice 109.5}. Do not say which product it belongs to. unit is one of kg, g, l, ml, piece, pack. Leave out counts printed without a unit price.",
  "category: household for anything that is not food or drink: shopping bags (POŞET, ALIŞVERİŞ POŞETİ, often cut to ALISVERIS), hygiene, cosmetics, tobacco and cleaning or laundry products such as fabric softener (YUMUŞATICI, abbreviated YUM. or KONS. YUM), detergent (DETERJAN, ÇAMAŞIR, BULAŞIK), bleach (ÇAMAŞIR SUYU) and brands like Linden, Yumoş, Ariel, Omo, Pril, Fairy, Domestos. Otherwise meat, snacks, dairy, drinks, produce, bakery, frozen or pantry (salt, spices, oil, canned food, soup mixes, rice, pasta, bulgur and legumes, e.g. DURU, YAYLA, REIS).",
  "health: healthy (fresh produce, plain dairy, eggs, fresh meat or fish, legumes, whole grains, water, olive oil), unhealthy (sugary food, sweets, snacks, sugary drinks, alcoholic drinks, processed meat), otherwise neutral. Household items are neutral.",
  "alcohol: true for every alcoholic drink, which is always unhealthy: wine (ŞARAP, VINHO, BRANCO, TINTO, ROSÉ, WEIN, VIN), beer (BİRA, CERVEJA, BIER), rakı, vodka, whisky, gin, liqueur, cider and similar, even when the name is abbreviated; otherwise false.",
  "fruitVeg: true only for fresh fruits and vegetables.",
  "merchant: the store brand name. currency: ISO 4217 code taken from symbols, labels or the country (Turkish receipts with TL, KDV or TOPKDV are TRY).",
  "total: the final amount payable (TOPLAM, ÖDENECEK TUTAR, TOTAL); never the tax total (TOPKDV, KDV), cash given or change.",
  "subtotal and addedTax: only when tax is added on top of the item prices (sales tax); null when prices already include tax (KDV, VAT, MwSt).",
  "Copy numbers exactly as printed, using a dot as the decimal separator. Do not calculate, correct or invent values. If the photo is not a readable receipt, set readable to false and items to [].",
].join("\n");

/** Another request owns this receipt's reading; the client retries until its result is stored. */
export class OCRPendingError extends Error {
  constructor() {
    super("Receipt OCR is still processing");
    this.name = "OCRPendingError";
  }
}

export function validateDoublewordImage(imageBase64: string): { base64: string; mime: string } {
  const base64 = validateImageBase64(imageBase64);
  // Leave room for JSON and prompt overhead under the provider's upload limit.
  if (base64.length > 700000) throw new OCRError("Receipt photo is too large for the receipt reader. Please upload a compressed photo.", "OCR_INVALID_INPUT");
  const bytes = Buffer.from(base64, "base64");
  const mime = bytes.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff])) ? "image/jpeg"
    : bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) ? "image/png"
      : bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP" ? "image/webp" : null;
  if (!mime) throw new OCRError("The receipt reader requires a JPEG, PNG or WebP receipt photo", "OCR_INVALID_INPUT");
  return { base64, mime };
}

/** True when the same item object keeps repeating: the model is inventing rows instead of reading the photo. */
export function hasRepeatedItemLoop(content: string): boolean {
  const items = content.match(/\{[^{}]*\}/g) ?? [];
  let repeats = 1;
  for (let index = 1; index < items.length; index++) {
    repeats = items[index] === items[index - 1] ? repeats + 1 : 1;
    // Identical purchases can be printed a few times in a row; eight copies are a decoding loop.
    if (repeats >= 8) return true;
  }
  // Items and quantity lines are both flat objects; together they cannot exceed both array limits.
  return items.length > MAX_ITEMS * 2 + 1;
}

const cents = (value: number) => Math.round(value * 100);
const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);

/** Spread a basket-level discount over priced items in cents so item prices still add up to the total. */
function allocateBasketDiscount(products: ClassificationResult[], discountCents: number): void {
  const totalCents = products.reduce((sum, product) => sum + cents(product.paidPrice!), 0);
  // An unallocatable discount stays visible as a price mismatch instead of being guessed away.
  if (discountCents <= 0 || discountCents > totalCents) return;
  let remaining = discountCents;
  const shares = products.map((product) => {
    const share = Math.floor(cents(product.paidPrice!) * discountCents / totalCents);
    remaining -= share;
    return share;
  });
  for (let index = 0; remaining > 0; index = (index + 1) % products.length) {
    if (cents(products[index].paidPrice!) - shares[index] > 0) {
      shares[index]++;
      remaining--;
    }
  }
  products.forEach((product, index) => {
    product.paidPrice = (cents(product.paidPrice!) - shares[index]) / 100;
  });
}

interface Measure { quantity: number; unit: typeof UNITS[number]; unitPrice: number }

/**
 * The model lists weight and count lines without saying whose they are: receipts print them above or below the
 * product, and reading that association from a skewed photo is unreliable. A line belongs to the next product, in
 * printed order, whose amount it reproduces (quantity x unit price, weights rounded to the cent); unmatched lines are
 * dropped rather than guessed.
 */
export function matchQuantities(totals: number[], quantities: Measure[]): Array<Measure | undefined> {
  const matched: Array<Measure | undefined> = totals.map(() => undefined);
  let start = 0;
  for (const measure of quantities) {
    const amount = cents(measure.quantity * measure.unitPrice);
    const fits = (index: number) => matched[index] === undefined && Math.abs(amount - cents(totals[index])) <= Math.max(2, cents(totals[index]) * 0.005);
    let index = totals.findIndex((_total, candidate) => candidate >= start && fits(candidate));
    // Two products can share an amount; the earlier unmatched one is the nearer candidate.
    if (index < 0) index = totals.findIndex((_total, candidate) => fits(candidate));
    if (index < 0) continue;
    matched[index] = measure;
    start = index + 1;
  }
  return matched;
}

/** Turn the model's JSON into the analysis the verification route stores; malformed readings are rejected. */
export function parseReceiptReading(content: string): ReceiptAnalysis {
  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(content.trim().replace(/^```(?:json)?\s*|\s*```$/g, ""));
  } catch {
    throw new OCRError("The receipt reader returned an invalid reading. No verification or payment was submitted.", "OCR_API_ERROR");
  }
  if (raw.readable === false) {
    throw new OCRError("The receipt photo could not be read clearly. Take a sharp, well-lit photo of the whole receipt and try again. No verification or payment was submitted.", "OCR_INVALID_INPUT");
  }
  const items = Array.isArray(raw.items) ? raw.items as Array<Record<string, unknown>> : [];
  const issues: string[] = [];
  const lines: Array<{ name: string; totalPrice: number; discount: number; category: typeof CATEGORIES[number]; health: typeof HEALTH[number]; fruitVeg: boolean }> = [];
  for (const item of items.slice(0, MAX_ITEMS)) {
    const name = typeof item.name === "string" ? item.name.replace(/\s+/g, " ").trim().slice(0, 200) : "";
    const category = CATEGORIES.find((value) => value === item.category);
    const { totalPrice, discount } = item;
    if (!name || !category || !finite(totalPrice) || totalPrice < 0 || !finite(discount) || discount < 0 || cents(discount) > cents(totalPrice)) {
      issues.push("Some receipt items could not be read completely");
      continue;
    }
    // Alcohol is a factual label the model answers reliably; it always counts as unhealthy, whatever the health label says.
    const health = item.alcohol === true ? "unhealthy" : HEALTH.find((value) => value === item.health) ?? "neutral";
    lines.push({ name, totalPrice, discount, category, health, fruitVeg: item.fruitVeg === true });
  }
  const quantities = (Array.isArray(raw.quantities) ? raw.quantities as Array<Record<string, unknown>> : []).flatMap((entry) => {
    const unit = UNITS.find((value) => value === entry.unit);
    return unit && finite(entry.quantity) && entry.quantity > 0 && finite(entry.unitPrice) && entry.unitPrice > 0
      ? [{ quantity: entry.quantity, unit, unitPrice: entry.unitPrice }] : [];
  });
  const measures = matchQuantities(lines.map((line) => line.totalPrice), quantities);
  const products: ClassificationResult[] = lines.map((line, index) => {
    const { quantity, unit } = measures[index] ?? { quantity: 1, unit: "piece" };
    const grams = unit === "kg" ? Math.round(quantity * 1000) : unit === "g" ? Math.round(quantity) : 0;
    if (grams > 50000) issues.push("Some receipt items have an unsupported weight");
    const pieces = unit === "piece" || unit === "pack" ? Math.max(1, Math.round(quantity)) : 1;
    const excluded = line.category === "household";
    const fruitVeg = line.fruitVeg && line.category === "produce" && line.health !== "unhealthy";
    return {
      name: line.name,
      category: excluded ? "excluded" : line.health,
      paidPrice: (cents(line.totalPrice) - cents(line.discount)) / 100,
      quantity: pieces,
      actualWeightGrams: grams,
      fruitVegGrams: excluded || !fruitVeg ? 0 : grams > 0 ? grams : DEFAULT_FRUIT_VEG_GRAMS * pieces,
      // Model labels carry no calibrated probability; this matches earlier model-labelled products.
      confidence: 0.6,
      spendingCategory: line.category,
    };
  });
  if (issues.length) throw new ReceiptAnalysisError([...new Set(issues)]);
  allocateBasketDiscount(products, finite(raw.basketDiscount) && raw.basketDiscount > 0 ? cents(raw.basketDiscount) : 0);

  const total = finite(raw.total) && raw.total > 0 ? raw.total : null;
  const subtotal = finite(raw.subtotal) ? raw.subtotal : null;
  const addedTax = finite(raw.addedTax) ? raw.addedTax : 0;
  const currency = typeof raw.currency === "string" ? raw.currency.trim().toUpperCase() : "";
  const merchant = typeof raw.merchant === "string" ? raw.merchant.replace(/\s+/g, " ").trim().slice(0, 80) : "";
  const itemsCents = products.reduce((sum, product) => sum + cents(product.paidPrice!), 0);
  const scored = products.filter((product) => product.category !== "excluded");
  const classification: FoodClassification = {
    totalItems: scored.length,
    detectedItems: products.length,
    excludedItems: products.length - scored.length,
    healthyItems: scored.filter((product) => product.category === "healthy").length,
    unhealthyItems: scored.filter((product) => product.category === "unhealthy").length,
    fruitVegGrams: scored.reduce((sum, product) => sum + product.fruitVegGrams, 0),
    products,
  };
  return {
    classification,
    metadata: {
      storeName: merchant && merchant.toLowerCase() !== "unknown" ? merchant : null,
      currencyCode: /^[A-Z]{3}$/.test(currency) ? currency : null,
      totalSpent: total,
      totalSpentSource: total !== null ? "receipt_total" : null,
      // A subtotal only counts when items exclude a separately printed tax: they match it, not the total.
      expectedItemsTotal: total !== null && subtotal !== null && addedTax > 0 && Math.abs(cents(subtotal + addedTax) - cents(total)) <= 1
        && Math.abs(itemsCents - cents(total)) > 1 && Math.abs(itemsCents - cents(subtotal)) <= 1 ? subtotal : null,
    },
    method: "model-schema",
  };
}

/** Read a streamed reply and stop as soon as the model degenerates into a loop. */
async function readStream(response: Response): Promise<{ content: string; complete: boolean; repeated: boolean }> {
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let content = "";
  let finishReason: string | undefined;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split("\n");
    buffer = events.pop() ?? "";
    for (const event of events) {
      const data = event.match(/^data:\s*(.*)$/)?.[1];
      if (!data || data === "[DONE]") continue;
      const chunk = JSON.parse(data) as { choices?: Array<{ finish_reason?: string | null; delta?: { content?: string | null } }> };
      content += chunk.choices?.[0]?.delta?.content ?? "";
      finishReason = chunk.choices?.[0]?.finish_reason ?? finishReason;
    }
    if (hasRepeatedItemLoop(content)) {
      await reader.cancel().catch(() => undefined);
      return { content, complete: false, repeated: true };
    }
  }
  return { content, complete: finishReason === "stop", repeated: false };
}

/** One realtime structured-output request; the verification route persists the result for retries. */
export async function readReceiptImage(imageBase64: string): Promise<ReceiptAnalysis> {
  const apiKey = process.env.OCR_API_KEY?.trim();
  if (!apiKey) throw new OCRError("The receipt reader is not configured", "OCR_API_ERROR");
  const { base64, mime } = validateDoublewordImage(imageBase64);
  let content: string;
  try {
    const response = await fetch("https://api.doubleword.ai/v1/chat/completions", {
      method: "POST",
      redirect: "error",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      signal: AbortSignal.timeout(45000),
      body: JSON.stringify({
        // Thinking is off: reasoning tokens add latency and cost without improving a transcription.
        model: MODEL, reasoning_effort: "none", temperature: 0, max_tokens: 8192, stream: true, service_tier: "priority",
        response_format: { type: "json_schema", json_schema: { name: "receipt", strict: true, schema: RECEIPT_SCHEMA } },
        messages: [{ role: "user", content: [
          { type: "text", text: RECEIPT_PROMPT },
          { type: "image_url", image_url: { url: `data:${mime};base64,${base64}` } },
        ] }],
      }),
    });
    if (!response.ok) throw new OCRError(`The receipt reader failed (HTTP ${response.status}). No verification or payment was submitted.`, "OCR_API_ERROR");
    const streamed = await readStream(response);
    if (streamed.repeated) {
      throw new OCRError("The receipt photo could not be read clearly. Take a sharp, well-lit photo of the whole receipt and try again. No verification or payment was submitted.", "OCR_INVALID_INPUT");
    }
    if (!streamed.complete || !streamed.content.trim() || streamed.content.length > 100000) {
      throw new OCRError("The receipt reader returned an incomplete reading. No verification or payment was submitted.", "OCR_API_ERROR");
    }
    content = streamed.content;
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") console.warn("Receipt reader timed out after 45s");
    if (error instanceof OCRError) throw error;
    // Never expose provider error bodies, API keys or the receipt image in logs.
    throw new OCRError("The receipt reader could not finish. No verification or payment was submitted. Try again shortly.", "OCR_API_ERROR");
  }
  return parseReceiptReading(content);
}

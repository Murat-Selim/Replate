import { classifyFoods, normalizeTurkish, parseReceiptAmount } from "./classifier.js";
import { OCRError, validateImageBase64 } from "./ocr.js";
import type { ReceiptAnalysis } from "./receipt-analysis.js";
import { extractReceiptMetadata } from "./receipt-metadata.js";

/** Keep table cells on their physical row; never flatten a column of prices. */
export function ocrReceiptLines(text: string): string[] {
  const plain = text
    .replace(/\*\*([^*\n]+)\*\*/g, "$1")
    .replace(/<\|det\|>\s*\[\[[\d.,\s]+\]\]/g, "")
    .replace(/<\|[^>]+\|>/g, "")
    .replace(/<tr\b[^>]*>/gi, "\n").replace(/<\/tr>/gi, "|\n")
    .replace(/<(?:td|th)\b[^>]*>/gi, "|").replace(/<\/(?:td|th)>/gi, " ")
    .replace(/<br\s*\/?\s*>/gi, " ").replace(/<\/(?:p|div|table)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&#(x[\da-f]+|\d+);/gi, (_match, value: string) => {
      const code = value.startsWith("x") || value.startsWith("X") ? parseInt(value.slice(1), 16) : Number(value);
      return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : "";
    })
    .replace(/&(?:nbsp|amp|lt|gt|quot|apos);/g, (entity) => ({
      "&nbsp;": " ", "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&apos;": "'",
    }[entity]!));
  const lines: string[] = [];
  let columns: { name: number; quantity: number; unit: number; total: number; count: number; ended: boolean } | undefined;
  for (const raw of plain.split(/\r?\n/)) {
    const line = raw.replace(/^\s*#{1,6}\s+/, "").trim();
    if (!line || /^```/.test(line) || /^\|?[\s:|-]+\|?$/.test(line)) continue;
    if (!line.includes("|")) {
      columns = undefined;
      lines.push(line);
      continue;
    }
    const cells = line.replace(/^\|/, "").replace(/\|$/, "").split("|").map((cell) => cell.trim());
    const headers = cells.map(normalizeTurkish);
    const name = headers.findIndex((cell) => /^(?:product(?: name)?|item(?: name)?|description|urun\s*adi)$/.test(cell));
    const quantity = headers.findIndex((cell) => /^(?:qty\.?|quantity|miktar)$/.test(cell));
    const unit = headers.findIndex((cell) => /^(?:unit|uom|brm|birim)$/.test(cell));
    const total = headers.reduce((last, cell, index) => /^(?:amount|line total|total|tutar|tutari|price|fiyat)$/.test(cell) ? index : last, -1);
    if (name >= 0 && total >= 0) {
      columns = { name, quantity, unit, total, count: cells.length, ended: false };
      continue;
    }
    const summaryRow = columns && cells.some((cell) => /^(?:total|sub\s*total|grand\s+total|final\s+total|tax|sales\s+tax|gst|hst|pst|toplam|ara\s+toplam|kdv|topkdv|odenecek\s+tutar)\b/.test(normalizeTurkish(cell)));
    if (columns && cells.length !== columns.count) throw new OCRError("The secondary OCR returned an incomplete table row. Try a clearer receipt photo.", "OCR_API_ERROR");
    if (columns && summaryRow) columns.ended = true;
    if (columns && !columns.ended && cells[columns.name]) {
      if (parseReceiptAmount(cells[columns.total]) === undefined) {
        // A unit price cannot stand in for a missing line total.
        lines.push(cells[columns.name]);
        continue;
      }
      // Receipts print "2 x 1,29" / "2 AD X 12,50"; the trailing unit price is not part of the quantity.
      const rawQuantity = (columns.quantity >= 0 ? cells[columns.quantity] : "")
        .replace(/\s*[x×]\s*(?:TL|TRY|USD|EUR|GBP|[$€£₺])?\s*\d+[.,]\d{2}(?:\s*(?:TL|TRY|USD|EUR|GBP|[$€£₺]))?(?:\s*\/\s*\w+)?$/i, "")
        .trim();
      if (!rawQuantity) {
        lines.push(`${cells[columns.name]} ${cells[columns.total]}`);
        continue;
      }
      const unit = (columns.unit >= 0 ? cells[columns.unit] : "").replace(/^(?:TL|TRY|USD|EUR|GBP|[$€£₺])\s*\/\s*(KG|G|GR)$/i, "$1");
      const inlineUnit = rawQuantity.match(/\s+(ADET|AD|EA|EACH|PCS|K[Iİ]LO|KG|G|GR)$/i)?.[1];
      if (inlineUnit && unit && normalizeTurkish(inlineUnit) !== normalizeTurkish(unit)) {
        throw new OCRError("The secondary OCR returned conflicting quantity units. Try a clearer receipt photo.", "OCR_API_ERROR");
      }
      const amount = (inlineUnit ? rawQuantity : `${rawQuantity} ${unit}`).trim().replace(/^([.,]\d)/, "0$1");
      // An unlabelled fractional quantity is ambiguous (pieces vs weight).
      if (!/^\d+(?:[.,]\d{1,3})?(?:\s+(?:ADET|AD|EA|EACH|PCS|K[Iİ]LO|KG|G|GR))?$/i.test(amount)
        || parseFloat(amount.replace(",", ".")) <= 0
        || (!/\s+(?:K[Iİ]LO|KG|G|GR)$/i.test(amount) && !Number.isInteger(parseFloat(amount.replace(",", "."))))) {
        throw new OCRError("The secondary OCR returned an ambiguous item quantity. Try a clearer receipt photo.", "OCR_API_ERROR");
      }
      const weightUnit = amount.match(/\s+(K[Iİ]LO|KG|G|GR)$/i)?.[1];
      const grams = parseFloat(amount.replace(",", ".")) * (weightUnit && /^K/i.test(weightUnit) ? 1000 : 1);
      if (weightUnit && (grams < 10 || grams > (/^K/i.test(weightUnit) ? 50000 : 5000))) {
        throw new OCRError("The secondary OCR returned an unsupported item weight. Try a clearer receipt photo.", "OCR_API_ERROR");
      }
      lines.push(`${cells[columns.name]} [qty=${amount}] ${cells[columns.total]}`);
    } else {
      lines.push(cells.join(" "));
    }
  }
  return lines;
}

export class OCRPendingError extends Error {
  constructor(public readonly responseId: string) {
    super("Receipt OCR is still processing");
    this.name = "OCRPendingError";
  }
}

async function doublewordRequest(endpoint: string, body?: unknown): Promise<ReceiptAnalysis> {
  const apiKey = process.env.OCR_API_KEY?.trim();
  if (!apiKey) throw new OCRError("Secondary receipt OCR is not configured", "OCR_API_ERROR");
  let content: string;
  try {
    const response = await fetch(body === undefined ? `https://api.doubleword.ai/v1/responses${endpoint}` : "https://api.doubleword.ai/v1/chat/completions", {
      method: body === undefined ? "GET" : "POST",
      redirect: "error",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      signal: AbortSignal.timeout(body === undefined ? 15000 : 45000),
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!response.ok) throw new OCRError(`Secondary receipt OCR failed (HTTP ${response.status}). No verification or payment was submitted.`, "OCR_API_ERROR");
    const data = await response.json() as {
      id?: string; status?: string;
      output?: Array<{ type?: string; role?: string; content?: string | Array<{ type?: string; text?: string }> }>;
      choices?: Array<{ finish_reason?: string; message?: { role?: string; content?: string } }>;
    };
    if (body === undefined && (data.status === "queued" || data.status === "in_progress") && typeof data.id === "string" && /^[a-zA-Z0-9_-]{1,200}$/.test(data.id)) {
      throw new OCRPendingError(data.id);
    }
    const choice = data.choices?.[0];
    content = body !== undefined ? (choice?.message?.content ?? "") : (data.output ?? []).filter((item) => item.type === "message" && item.role === "assistant").map((item) =>
      typeof item.content === "string" ? item.content : (item.content ?? []).filter((part) => part.type === "output_text").map((part) => part.text ?? "").join("\n")
    ).join("\n");
    const complete = body !== undefined ? choice?.finish_reason === "stop" && choice.message?.role === "assistant" : data.status === "completed";
    if (!complete || typeof content !== "string" || !content.trim() || content.length > 100000) {
      throw new OCRError("Secondary receipt OCR returned an incomplete or invalid reading. No verification or payment was submitted.", "OCR_API_ERROR");
    }
  } catch (error) {
    if (error instanceof OCRError || error instanceof OCRPendingError) throw error;
    // Never expose provider error bodies, API keys or the receipt image in logs.
    throw new OCRError("Secondary receipt OCR could not finish. No verification or payment was submitted. Try again shortly.", "OCR_API_ERROR");
  }
  const lines = ocrReceiptLines(content);
  const classification = await classifyFoods(lines);
  return { classification, metadata: extractReceiptMetadata(lines, classification.products), method: "image-recovery" };
}

export function validateDoublewordImage(imageBase64: string): { base64: string; mime: string } {
  const base64 = validateImageBase64(imageBase64);
  // Leave room for JSON and prompt overhead under the provider's upload limit.
  if (base64.length > 700000) throw new OCRError("Receipt photo is too large for secondary OCR. Please upload a compressed photo.", "OCR_INVALID_INPUT");
  const bytes = Buffer.from(base64, "base64");
  const mime = bytes.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff])) ? "image/jpeg"
    : bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) ? "image/png"
      : bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP" ? "image/webp" : null;
  if (!mime) throw new OCRError("Secondary OCR requires a JPEG, PNG or WebP receipt photo", "OCR_INVALID_INPUT");
  return { base64, mime };
}

/** One realtime request; the verification route persists the result for retries. */
export async function readReceiptWithDoubleword(imageBase64: string): Promise<ReceiptAnalysis> {
  const { base64, mime } = validateDoublewordImage(imageBase64);
  return doublewordRequest("", {
    model: "Qwen/Qwen3-VL-30B-A3B-Instruct-FP8", temperature: 0, max_tokens: 4096, stream: false,
    service_tier: "priority",
    // Qwen can loop on empty table rows until max_tokens (~2 min), far past the request timeout.
    stop: ["| | | | | |\n| | | | | |", "|  |  |  |  |  |\n|  |  |  |  |  |"],
    messages: [{ role: "user", content: [
      { type: "text", text: "Transcribe this grocery receipt faithfully as Markdown. Keep every purchased product in printed order, including repeated products. Use a table with columns Product, Qty, Unit, Unit Price, Amount. Copy the printed quantity or weight and its unit when present; otherwise leave those cells blank. Amount must be the printed line total, not the unit price. Keep package sizes in the product name. Include the printed merchant, date, currency symbols, subtotal, tax, discounts and final total outside the product table. Never output empty table rows; end the table after the last product. Do not calculate, guess, translate, correct or add missing data. Return only the transcription." },
      { type: "image_url", image_url: { url: `data:${mime};base64,${base64}` } },
    ] }],
  });
}

/** Resume only previously submitted background jobs; new reads use Chat Completions. */
export async function pollReceiptWithDoubleword(responseId: string): Promise<ReceiptAnalysis> {
  if (!/^[a-zA-Z0-9_-]{1,200}$/.test(responseId)) throw new OCRError("Invalid receipt OCR job", "OCR_INVALID_INPUT");
  return doublewordRequest(`/${encodeURIComponent(responseId)}`);
}

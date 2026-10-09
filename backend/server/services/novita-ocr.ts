import { classifyFoods, normalizeTurkish } from "./classifier.js";
import { OCRError, validateImageBase64 } from "./ocr.js";
import type { ReceiptAnalysis } from "./receipt-analysis.js";
import { extractReceiptMetadata } from "./receipt-metadata.js";

/** Keep table cells on their physical row; never flatten a column of prices. */
export function novitaReceiptLines(text: string): string[] {
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
  let columns: { name: number; quantity: number; unit: number; total: number; count: number } | undefined;
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
      columns = { name, quantity, unit, total, count: cells.length };
      continue;
    }
    const summaryRow = columns && /^(?:total|sub\s*total|grand\s+total|tax|sales\s+tax|gst|hst|pst|toplam|ara\s+toplam|kdv|odenecek\s+tutar)\b/.test(normalizeTurkish(cells[columns.name] ?? ""));
    if (columns && cells.length !== columns.count) throw new OCRError("The secondary OCR returned an incomplete table row. Try a clearer receipt photo.", "OCR_API_ERROR");
    if (columns && !summaryRow && columns.quantity >= 0) {
      const amount = `${cells[columns.quantity]} ${columns.unit >= 0 ? cells[columns.unit] : ""}`.trim();
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

/** One bounded server-side recovery request; the caller validates prices and categories. */
export async function readReceiptWithNovita(imageBase64: string): Promise<ReceiptAnalysis> {
  const apiKey = process.env.NOVITA_API_KEY?.trim();
  if (!apiKey) throw new OCRError("Secondary receipt OCR is not configured", "OCR_API_ERROR");
  const base64 = validateImageBase64(imageBase64);
  const bytes = Buffer.from(base64, "base64");
  const mime = bytes.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff])) ? "image/jpeg"
    : bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) ? "image/png"
      : bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP" ? "image/webp" : null;
  if (!mime) throw new OCRError("Secondary OCR requires a JPEG, PNG or WebP receipt photo", "OCR_INVALID_INPUT");

  let content: string;
  try {
    const response = await fetch("https://api.novita.ai/openai/v1/chat/completions", {
      method: "POST",
      redirect: "error",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      signal: AbortSignal.timeout(30000),
      body: JSON.stringify({
        model: "deepseek/deepseek-ocr-2", temperature: 0, top_k: 0, max_tokens: 4096, stream: false,
        messages: [{ role: "user", content: [
          { type: "image_url", image_url: { url: `data:${mime};base64,${base64}` } },
          { type: "text", text: "<|grounding|>Convert the document to markdown." },
        ] }],
      }),
    });
    if (!response.ok) throw new OCRError(`Secondary receipt OCR failed (HTTP ${response.status}). No verification or payment was submitted.`, "OCR_API_ERROR");
    const data = await response.json() as { choices?: Array<{ finish_reason?: string; message?: { content?: unknown } }> };
    const choice = data.choices?.[0];
    if (choice?.finish_reason !== "stop" || typeof choice.message?.content !== "string" || !choice.message.content.trim() || choice.message.content.length > 100000) {
      throw new OCRError("Secondary receipt OCR returned an incomplete or invalid reading. No verification or payment was submitted.", "OCR_API_ERROR");
    }
    content = choice.message.content;
  } catch (error) {
    if (error instanceof OCRError) throw error;
    // Never expose provider error bodies, API keys or the receipt image in logs.
    throw new OCRError("Secondary receipt OCR could not finish. No verification or payment was submitted. Try again shortly.", "OCR_API_ERROR");
  }
  const lines = novitaReceiptLines(content);
  const classification = await classifyFoods(lines);
  return { classification, metadata: extractReceiptMetadata(lines, classification.products), method: "image-recovery" };
}

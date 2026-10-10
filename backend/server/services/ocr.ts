import fs from "fs";
import path from "path";
import { ImageAnnotatorClient, type protos } from "@google-cloud/vision";

// Initialize Vision client lazily
let visionClient: ImageAnnotatorClient | null = null;

/** Reject scans below this Vision page confidence (0–1). */
export const MIN_OCR_CONFIDENCE = 0.3;

/** ~5MB decoded image; base64 is ~4/3 of binary size. */
const MAX_BASE64_CHARS = 7_000_000;
const MIN_BASE64_CHARS = 80;

export class OCRError extends Error {
  constructor(
    message: string,
    public readonly code: "OCR_INVALID_INPUT" | "OCR_EMPTY" | "OCR_LOW_CONFIDENCE" | "OCR_API_ERROR"
  ) {
    super(message);
    this.name = "OCRError";
  }
}

/**
 * Resolve Google credentials from env:
 * - GOOGLE_CREDENTIALS_JSON or GOOGLE_APPLICATION_CREDENTIALS_JSON = raw JSON string OR path to a .json key file
 * - else GOOGLE_APPLICATION_CREDENTIALS (ADC / file path handled by client)
 */
function loadGoogleCredentials(): object | null {
  const raw = (process.env.GOOGLE_CREDENTIALS_JSON || process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON)?.trim();
  if (!raw) return null;

  // Inline JSON object
  if (raw.startsWith("{")) {
    try {
      return JSON.parse(raw);
    } catch (error) {
      console.error("❌ Failed to parse GOOGLE_CREDENTIALS_JSON as JSON:", error);
      throw new Error(
        "GOOGLE_CREDENTIALS_JSON looks like JSON but is invalid. " +
          "Fix the env var or set USE_MOCK_OCR=true for development."
      );
    }
  }

  // Path to service-account key file (common local setup: gcloud-key.json)
  const keyPath = path.isAbsolute(raw) ? raw : path.resolve(process.cwd(), raw);
  if (!fs.existsSync(keyPath)) {
    throw new Error(
      `GOOGLE_CREDENTIALS_JSON points to missing file: ${keyPath}. ` +
        "Use a path to your service-account JSON or paste the JSON inline."
    );
  }
  try {
    return JSON.parse(fs.readFileSync(keyPath, "utf8"));
  } catch (error) {
    console.error("❌ Failed to read credentials file:", error);
    throw new Error(`Could not read Google credentials from ${keyPath}`);
  }
}

export function getVisionClient(): ImageAnnotatorClient {
  if (!visionClient) {
    const credentials = loadGoogleCredentials();
    if (credentials) {
      visionClient = new ImageAnnotatorClient({ credentials });
    } else {
      // Uses GOOGLE_APPLICATION_CREDENTIALS or ambient ADC
      visionClient = new ImageAnnotatorClient();
    }
  }
  return visionClient;
}

export interface OCRResult {
  fullText: string;
  lines: string[];
  /** Physical rows for analysis; original lines remain the receipt identity input. */
  analysisLines?: string[];
  /** Original layout retained for offline diagnosis and row reconstruction. */
  annotation?: protos.google.cloud.vision.v1.ITextAnnotation;
  confidence: number;
}

/** Join receipt columns by their physical row instead of Vision's paragraph order. */
export function reconstructReceiptLines(annotation: protos.google.cloud.vision.v1.ITextAnnotation | null | undefined, fallback: string[]): string[] {
  if (!annotation?.pages?.length) return fallback;
  const output: string[] = [];
  for (const page of annotation.pages) {
    const words = (page.blocks ?? []).flatMap((block) => (block.paragraphs ?? []).flatMap((paragraph) => paragraph.words ?? []));
    if (!words.length) return fallback;
    const positioned = [];
    for (const word of words) {
      const text = (word.symbols ?? []).map((symbol) => symbol.text ?? "").join("").trim();
      if (!text) continue;
      const vertices = word.boundingBox?.vertices?.length ? word.boundingBox.vertices
        : word.boundingBox?.normalizedVertices?.map((vertex) => ({ x: (vertex.x ?? 0) * (page.width ?? 1), y: (vertex.y ?? 0) * (page.height ?? 1) }));
      if (vertices?.length !== 4) return fallback;
      const points = vertices.map((vertex) => ({ x: vertex.x ?? 0, y: vertex.y ?? 0 }));
      const dx = points[1].x - points[0].x;
      const dy = points[1].y - points[0].y;
      const height = Math.hypot(points[3].x - points[0].x, points[3].y - points[0].y);
      const width = Math.hypot(dx, dy);
      if (!height || !width) return fallback;
      positioned.push({ text, x: points.reduce((sum, point) => sum + point.x, 0) / 4, y: points.reduce((sum, point) => sum + point.y, 0) / 4, height, width, angle: Math.atan2(dy, dx) });
    }
    if (!positioned.length) return fallback;
    const angles = positioned.map((word) => word.angle).sort((a, b) => a - b);
    const angle = angles[Math.floor(angles.length / 2)];
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const aligned = positioned.map((word) => ({ ...word, x: word.x * cos + word.y * sin, y: word.y * cos - word.x * sin, angle: word.angle - angle })).sort((a, b) => a.x - b.x || a.y - b.y);
    const rows: Array<{ x: number; y: number; height: number; width: number; angle: number; words: typeof aligned }> = [];
    for (const word of aligned) {
      // Curved receipts have different slopes at the top and bottom; match each row locally.
      let row: typeof rows[number] | undefined;
      let nearest = Infinity;
      for (const candidate of rows) {
        const slope = Math.tan((word.angle + candidate.angle) / 2);
        const distance = Math.abs(word.y - candidate.y - slope * (word.x - candidate.x)) / Math.hypot(1, slope);
        if (distance <= Math.min(word.height, candidate.height) * 0.65 && distance < nearest) {
          row = candidate;
          nearest = distance;
        }
      }
      if (row) {
        const count = row.words.length;
        row.x = (row.x * count + word.x) / (count + 1);
        row.y = (row.y * count + word.y) / (count + 1);
        row.height = (row.height * count + word.height) / (count + 1);
        row.angle = (row.angle * row.width + word.angle * word.width) / (row.width + word.width);
        row.width += word.width;
        row.words.push(word);
      } else {
        rows.push({ x: word.x, y: word.y, height: word.height, width: word.width, angle: word.angle, words: [word] });
      }
    }
    output.push(...rows.sort((a, b) => a.words[0].y - b.words[0].y).map((row) => row.words.map((word) => word.text).join(" ")
      .replace(/(\d)\s+([.,])\s*(?=\d)/g, "$1$2").replace(/([%*])\s+(?=\d)/g, "$1")
      .replace(/(\p{L})\s+\.(?=\s|$)/gu, "$1.").replace(/\bTL\s*\/\s*(kg|ad|adet|lt)\b/gi, "TL/$1")));
  }
  return output;
}

/**
 * Strips the data URL prefix from a base64 string if present.
 * Handles all image types: jpeg, jpg, png, webp, heic, etc.
 */
function stripBase64Prefix(imageBase64: string): string {
  return imageBase64.replace(/^data:image\/[\w.+-]+;base64,/, "");
}

/**
 * Validates base64 image payload before calling Vision.
 */
export function validateImageBase64(imageBase64: string): string {
  if (!imageBase64 || typeof imageBase64 !== "string") {
    throw new OCRError("Image is required", "OCR_INVALID_INPUT");
  }

  const base64 = stripBase64Prefix(imageBase64.trim());

  if (base64.length < MIN_BASE64_CHARS) {
    throw new OCRError("Image data is too small or empty", "OCR_INVALID_INPUT");
  }
  if (base64.length > MAX_BASE64_CHARS) {
    throw new OCRError("Image is too large (max ~5MB)", "OCR_INVALID_INPUT");
  }
  // Quick sanity check: base64 alphabet only
  if (!/^[A-Za-z0-9+/=\s]+$/.test(base64)) {
    throw new OCRError("Image is not valid base64", "OCR_INVALID_INPUT");
  }

  return base64.replace(/\s/g, "");
}

/**
 * Returns true when OCR produced usable receipt text.
 */
export function isOCRResultUsable(result: OCRResult): boolean {
  if (!result.lines.length) return false;
  // confidence === 0 with empty fullText is unusable; mock/real with text is OK
  if (result.confidence > 0 && result.confidence < MIN_OCR_CONFIDENCE) {
    return false;
  }
  return true;
}

/**
 * Throws OCRError if the result should not proceed to classification.
 */
export function assertUsableOCR(result: OCRResult): void {
  if (!result.lines.length) {
    throw new OCRError(
      "Receipt could not be read — no text found. Try a clearer photo.",
      "OCR_EMPTY"
    );
  }
  if (result.confidence > 0 && result.confidence < MIN_OCR_CONFIDENCE) {
    throw new OCRError(
      "Receipt image quality is too low. Try better lighting or a sharper photo.",
      "OCR_LOW_CONFIDENCE"
    );
  }
}

/**
 * Process a receipt image using Google Cloud Vision OCR.
 * @param imageBase64 - Base64 encoded image (with or without data URL prefix)
 * @returns Extracted text and lines from the receipt
 */
export async function processOCR(imageBase64: string): Promise<OCRResult> {
  const hasCredentials =
    process.env.GOOGLE_APPLICATION_CREDENTIALS ||
    process.env.GOOGLE_CREDENTIALS_JSON ||
    process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;

  const mockRequested =
    process.env.NODE_ENV !== "production" && process.env.USE_MOCK_OCR === "true";
  if (mockRequested) {
    console.log(
      `⚠️ ${
        "Mock OCR requested"
      }, using mock OCR`
    );
    return mockOCR();
  }
  if (!hasCredentials) {
    throw new OCRError("Receipt OCR service is not configured", "OCR_API_ERROR");
  }

  const base64 = validateImageBase64(imageBase64);

  try {
    const client = getVisionClient();

    // languageHints improve Turkish receipt accuracy (ş, ğ, ı, etc.)
    const [batch] = await client.batchAnnotateImages({ requests: [{
      image: { content: base64 },
      features: [{ type: "DOCUMENT_TEXT_DETECTION" }],
      imageContext: { languageHints: ["tr", "en"] },
    }] }, { timeout: 15000, retry: null });
    const result = batch.responses?.[0];
    if (!result || result.error?.code || result.error?.message) throw new OCRError("Failed to process receipt image", "OCR_API_ERROR");

    const detections = result.textAnnotations;

    const fullText = result.fullTextAnnotation?.text || detections?.[0]?.description || "";
    if (!fullText) {
      return { fullText: "", lines: [], confidence: 0 };
    }

    // documentTextDetection is optimized for dense receipt text.
    const lines = fullText
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    // Some Vision responses omit page confidence even when text is usable.
    const pageConfidence = result.fullTextAnnotation?.pages?.[0]?.confidence;
    const confidence =
      typeof pageConfidence === "number" && pageConfidence > 0
        ? pageConfidence
        : 0.9;

    return { fullText, lines, analysisLines: reconstructReceiptLines(result.fullTextAnnotation, lines), annotation: result.fullTextAnnotation ?? undefined, confidence };
  } catch (error) {
    if (error instanceof OCRError) throw error;
    console.error("❌ Vision API error:", error);
    throw new OCRError("Failed to process receipt image", "OCR_API_ERROR");
  }
}

/**
 * Mock OCR for development without Google Cloud credentials.
 * Uses a realistic Turkish grocery receipt (Migros/BİM format) to properly
 * exercise Replate's Turkish keyword classification, KDV patterns,
 * weight extraction, and SKIP_PATTERNS logic.
 */
function mockOCR(): OCRResult {
  const mockLines = [
    // Store header — should be skipped by SKIP_PATTERNS
    "MİGROS TİCARET A.Ş.",
    "Migros Jet ESENYURT",
    "ADRES: Cumhuriyet MH. Atatürk CAD.",
    "VKN: 1234567890",
    "TARIH: 15.01.2024  SAAT: 14:32",
    "KASA NO: 04  KASİYER: 12",
    "--------------------------------",

    // Healthy items — fruits & vegetables with Turkish receipt format
    "ELMA STARKING x109,50 TL/kg %01 *42,51",
    "MUZ x72,50 TL/kg %01 *54,99",
    "0.755",
    "DOMATES x119,50 TL/kg %01 *51,39",
    "0.430",
    "LIMON %01 *14,43",
    "0.145",
    "PORTAKAL %01 *45,54",
    "MAYDANOZ %01 *29,50",
    "BIBER CARLISTON PAKET (300G) %01 *54,50",
    "SALALIK %01 *73,13",
    "0.475",
    "PATATES x21,50 TL/kg *20,04",
    "0.915",
    "ARMUT DEVECI x99,50 TL/kg *54,74",

    // Healthy items — protein & dairy
    "BUTUN TAVUK POSETLI x125,00 TL/kg %01 *233,00",
    "1.864",
    "YUMURTA 15LI L 63-72 G %01 *99,00",
    "SUT YAGLI 1 L BIRSAN %01 *46,00",
    "CAY TURKAK 1 L BIRSAN %01 *149,95",

    // Unhealthy / processed items
    "SEKER TOZ 2000 G PETEK %01 *87,50",
    "MARGARIN PAKET 250 G VERA %01 *23,00",
    "BAR KAKAO KAPL. YER FISTIKLI %01 *8,00",
    "KAHVE INS. 3U 1 ARADA 17.5 G N %01 *12,25",
    "CIPS KLASIK 150 G %01 *32,50",

    // Non-food — should be skipped
    "ALISVERIS POSETI %20 *4,00",

    // Totals — should be skipped by SKIP_PATTERNS
    "--------------------------------",
    "ARA TOPLAM",
    "TOPLAM                    *1.135,97",
    "KDV %01                      *11,25",
    "NAKIT                     *1.200,00",
    "PARA USTU                    *64,03",
    "--------------------------------",
    "TESEKKUR EDERIZ",
    "FIS NO: 20240115-00847",
  ];

  return {
    fullText: mockLines.join("\n"),
    lines: mockLines,
    confidence: 0.95,
  };
}

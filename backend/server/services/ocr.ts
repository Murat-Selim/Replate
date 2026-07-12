import fs from "fs";
import path from "path";
import { ImageAnnotatorClient } from "@google-cloud/vision";

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
 * - GOOGLE_CREDENTIALS_JSON = raw JSON string OR path to a .json key file
 * - else GOOGLE_APPLICATION_CREDENTIALS (ADC / file path handled by client)
 */
function loadGoogleCredentials(): object | null {
  const raw = process.env.GOOGLE_CREDENTIALS_JSON?.trim();
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

function getVisionClient(): ImageAnnotatorClient {
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
  confidence: number;
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
function validateImageBase64(imageBase64: string): string {
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
    process.env.GOOGLE_CREDENTIALS_JSON;

  if (process.env.USE_MOCK_OCR === "true" || !hasCredentials) {
    console.log(
      `⚠️ ${
        !hasCredentials ? "No Google Cloud credentials" : "Mock OCR requested"
      }, using mock OCR`
    );
    return mockOCR();
  }

  const base64 = validateImageBase64(imageBase64);

  try {
    const client = getVisionClient();

    // languageHints improve Turkish receipt accuracy (ş, ğ, ı, etc.)
    const [result] = await client.textDetection({
      image: { content: base64 },
      imageContext: { languageHints: ["tr", "en"] },
    });

    const detections = result.textAnnotations;

    if (!detections || detections.length === 0) {
      return { fullText: "", lines: [], confidence: 0 };
    }

    // detections[0].description is full receipt text with newlines
    const fullText = detections[0].description || "";
    const lines = fullText
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    // Page-level confidence from fullTextAnnotation (word-level is often undefined)
    const confidence =
      result.fullTextAnnotation?.pages?.[0]?.confidence ?? 0.9;

    return { fullText, lines, confidence };
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
    "MEZE CIKOFTE 384 G COKCA %01 *32,50",

    // Non-food — should be skipped
    "ALISVERIS POSETI %20 *4,00",

    // Totals — should be skipped by SKIP_PATTERNS
    "--------------------------------",
    "ARA TOPLAM",
    "TOPLAM                    *1.245,67",
    "KDV %01                      *12,46",
    "NAKIT                     *1.300,00",
    "PARA USTU                    *54,33",
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

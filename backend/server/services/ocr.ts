import { ImageAnnotatorClient } from "@google-cloud/vision";

// Initialize Vision client lazily
let visionClient: ImageAnnotatorClient | null = null;

function getVisionClient(): ImageAnnotatorClient {
  if (!visionClient) {
    if (process.env.GOOGLE_CREDENTIALS_JSON) {
      try {
        const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS_JSON);
        visionClient = new ImageAnnotatorClient({ credentials });
      } catch (error) {
        console.error("❌ Failed to parse GOOGLE_CREDENTIALS_JSON:", error);
        throw new Error(
          "GOOGLE_CREDENTIALS_JSON is set but contains invalid JSON. " +
          "Fix the env var or set USE_MOCK_OCR=true for development."
        );
      }
    } else {
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
      `⚠️ ${!hasCredentials ? "No Google Cloud credentials" : "Mock OCR requested"
      }, using mock OCR`
    );
    return mockOCR();
  }

  try {
    const client = getVisionClient();
    const base64 = stripBase64Prefix(imageBase64);

    const [result] = await client.textDetection({
      image: { content: base64 },
    });

    const detections = result.textAnnotations;

    if (!detections || detections.length === 0) {
      return { fullText: "", lines: [], confidence: 0 };
    }

    // FIX 1: Use fullText directly from the first annotation.
    // detections[0].description already contains the entire receipt text
    // with proper newlines — splitting on \n is simpler and more accurate
    // than reconstructing lines from individual word bounding boxes.
    const fullText = detections[0].description || "";
    const lines = fullText
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    // FIX 2: Read confidence from fullTextAnnotation.pages which is the
    // correct source for document-level confidence in Vision API responses.
    // Averaging word-level detections[i].confidence returns mostly undefined.
    const confidence =
      result.fullTextAnnotation?.pages?.[0]?.confidence ?? 0.9;

    return { fullText, lines, confidence };
  } catch (error) {
    console.error("❌ Vision API error:", error);
    throw new Error("Failed to process receipt image");
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

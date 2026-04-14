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
        visionClient = new ImageAnnotatorClient();
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
 * Includes a realistic mix of healthy and unhealthy items to properly
 * exercise Replate's health scoring and classification logic.
 */
function mockOCR(): OCRResult {
  const mockLines = [
    // Store header
    "WHOLE FOODS MARKET",
    "123 Main Street, San Francisco CA",
    "Tel: (415) 555-0100",
    "Date: 2024-01-15  Time: 14:32",
    "Cashier: #4  Register: 02",
    "--------------------------------",

    // Healthy items
    "Organic Bananas       1.2lb  $1.44",
    "Baby Spinach 5oz             $3.99",
    "Avocados 2ct                 $4.00",
    "Greek Yogurt 32oz            $5.99",
    "Chicken Breast 1lb           $8.99",
    "Brown Rice 2lb               $4.49",
    "Broccoli Crown 1lb           $2.49",
    "Carrots 2lb Bag              $1.99",
    "Extra Virgin Olive Oil 500ml $9.99",
    "Blueberries 6oz              $4.49",
    "Salmon Fillet 0.8lb          $9.59",

    // Unhealthy / processed items
    "Coca-Cola 12pk               $6.99",
    "Chips Ahoy Cookies           $3.49",
    "Frozen Pepperoni Pizza       $5.99",
    "Lay's Classic Chips 8oz      $4.29",

    // Totals
    "--------------------------------",
    "SUBTOTAL                    $77.72",
    "TAX (8.5%)                   $6.61",
    "TOTAL                       $84.33",
    "--------------------------------",
    "CASH                       $100.00",
    "CHANGE                      $15.67",
    "--------------------------------",
    "Thank you for shopping!",
    "Receipt #: 20240115-00847",
  ];

  return {
    fullText: mockLines.join("\n"),
    lines: mockLines,
    confidence: 0.95,
  };
}

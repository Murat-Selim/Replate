import { ImageAnnotatorClient } from "@google-cloud/vision";

// Initialize Vision client
// Uses GOOGLE_APPLICATION_CREDENTIALS env var for auth
let visionClient: ImageAnnotatorClient | null = null;

function getVisionClient(): ImageAnnotatorClient {
  if (!visionClient) {
    // If GOOGLE_CREDENTIALS_JSON is provided, use it directly
    if (process.env.GOOGLE_CREDENTIALS_JSON) {
      try {
        const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS_JSON);
        visionClient = new ImageAnnotatorClient({ credentials });
      } catch (error) {
        console.error("❌ Failed to parse GOOGLE_CREDENTIALS_JSON:", error);
        visionClient = new ImageAnnotatorClient();
      }
    } else {
      // Fallback to default (uses GOOGLE_APPLICATION_CREDENTIALS path)
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
 * Process a receipt image using Google Cloud Vision OCR
 * @param imageBase64 - Base64 encoded image (without data URL prefix)
 * @returns Extracted text lines from the receipt
 */
export async function processOCR(imageBase64: string): Promise<OCRResult> {
  // Check for mock mode (no credentials)
  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    console.log("⚠️ No Google Cloud credentials, using mock OCR");
    return mockOCR();
  }

  try {
    const client = getVisionClient();

    // Remove data URL prefix if present
    const base64 = imageBase64.replace(/^data:image\/\w+;base64,/, "");

    // Call Vision API
    const [result] = await client.textDetection({
      image: { content: base64 },
    });

    const detections = result.textAnnotations;

    if (!detections || detections.length === 0) {
      return { fullText: "", lines: [], confidence: 0 };
    }

    // First annotation is the full text
    const fullText = detections[0].description || "";

    // Extract individual lines (remaining annotations are words/blocks)
    const lines: string[] = [];
    const currentLine = new Map<number, string[]>();

    for (let i = 1; i < detections.length; i++) {
      const word = detections[i];
      if (word.description && word.boundingPoly?.vertices) {
        const y = word.boundingPoly.vertices[0]?.y || 0;
        if (!currentLine.has(y)) {
          currentLine.set(y, []);
        }
        currentLine.get(y)!.push(word.description);
      }
    }

    // Sort by Y coordinate and join words into lines
    const sortedYs = Array.from(currentLine.keys()).sort((a, b) => a - b);
    for (const y of sortedYs) {
      const words = currentLine.get(y);
      if (words && words.length > 0) {
        lines.push(words.join(" "));
      }
    }

    // Calculate average confidence
    const confidence = detections.length > 1
      ? detections.slice(1).reduce((sum, d) => sum + (d.confidence || 0), 0) / (detections.length - 1)
      : 0.9;

    return {
      fullText,
      lines: lines.filter(line => line.trim().length > 0),
      confidence,
    };
  } catch (error) {
    console.error("❌ Vision API error:", error);
    throw new Error("Failed to process receipt image");
  }
}

/**
 * Mock OCR for development without Google Cloud credentials
 */
function mockOCR(): OCRResult {
  // Simulate a typical grocery receipt
  const mockLines = [
    "WHOLE FOODS MARKET",
    "Date: 2024-01-15",
    "Organic Bananas 1.2lb $1.44",
    "Baby Spinach 5oz $3.99",
    "Avocados 2ct $4.00",
    "Greek Yogurt 32oz $5.99",
    "Chicken Breast 1lb $8.99",
    "Brown Rice 2lb $4.49",
    "Broccoli 1lb $2.49",
    "Carrots 2lb $1.99",
    "Olive Oil 500ml $9.99",
    "Coca-Cola 12pk $6.99",
    "Chips Ahoy $3.49",
    "Frozen Pizza $5.99",
    "TOTAL $59.83",
  ];

  return {
    fullText: mockLines.join("\n"),
    lines: mockLines,
    confidence: 0.95,
  };
}

import { Router, Request, Response } from "express";
import { processOCR, assertUsableOCR, OCRError } from "../services/ocr.js";
import { classifyFoods, ClassificationResult } from "../services/classifier.js";
import { submitReceiptToContract, calculateScores } from "../services/contract.js";
import { clearLeaderboardCache } from "./leaderboard.js";

const router = Router();

interface VerifyReceiptRequest {
  imageBase64: string;
  userAddress: string;
  householdSize: number;
  daysCovered?: number;
  fid?: number; // Farcaster ID
  onlyAnalyze?: boolean;
}

interface VerifyReceiptResponse {
  success: boolean;
  data?: {
    txHash: string;
    healthScore: number;
    nutritionScore: number;
    totalItems: number;
    healthyItems: number;
    unhealthyItems: number;
    fruitVegGrams: number;
    daysCovered: number;
    pointsEarned: number;
    badgeMinted: boolean;
    products: ClassificationResult[];
    /** Vision OCR page confidence (0–1); useful for client UX */
    ocrConfidence: number;
  };
  error?: string;
  errorCode?: string;
}

router.post("/", async (req: Request, res: Response) => {
  try {
    const { imageBase64, userAddress, householdSize, daysCovered, fid, onlyAnalyze } = req.body as VerifyReceiptRequest;

    // Validation
    if (!imageBase64) {
      res.status(400).json({ success: false, error: "Image is required", errorCode: "OCR_INVALID_INPUT" } as VerifyReceiptResponse);
      return;
    }
    if (!userAddress || !/^0x[a-fA-F0-9]{40}$/.test(userAddress)) {
      res.status(400).json({ success: false, error: "Valid user address is required" } as VerifyReceiptResponse);
      return;
    }
    if (!householdSize || householdSize < 1 || householdSize > 10) {
      res.status(400).json({ success: false, error: "Household size must be 1-10" } as VerifyReceiptResponse);
      return;
    }

    console.log(`📸 Processing receipt for ${userAddress} (onlyAnalyze: ${!!onlyAnalyze})...`);

    // Step 1: OCR - Extract text from receipt
    const ocrResult = await processOCR(imageBase64);
    console.log(
      `📝 OCR found ${ocrResult.lines.length} lines (confidence: ${ocrResult.confidence.toFixed(2)})`
    );

    // Gate: reject empty / low-quality scans before classification or on-chain submit
    assertUsableOCR(ocrResult);

    // Step 2: Classify food items
    const classification = await classifyFoods(ocrResult.lines);
    console.log(`🥗 Classification: ${classification.healthyItems} healthy, ${classification.unhealthyItems} unhealthy`);

    if (classification.totalItems === 0) {
      res.status(400).json({
        success: false,
        error: "No food products found on this receipt. Try a full grocery receipt photo.",
        errorCode: "NO_PRODUCTS",
      } as VerifyReceiptResponse);
      return;
    }

    const targetDaysCovered = daysCovered || estimateDaysCovered(classification.totalItems, householdSize);

    if (onlyAnalyze) {
      const scores = calculateScores({
        user: userAddress,
        totalItems: classification.totalItems,
        healthyItems: classification.healthyItems,
        unhealthyItems: classification.unhealthyItems,
        fruitVegGrams: classification.fruitVegGrams,
        householdSize,
        daysCovered: targetDaysCovered,
      });

      res.json({
        success: true,
        data: {
          txHash: "",
          healthScore: scores.healthScore,
          nutritionScore: scores.nutritionScore,
          totalItems: classification.totalItems,
          healthyItems: classification.healthyItems,
          unhealthyItems: classification.unhealthyItems,
          fruitVegGrams: classification.fruitVegGrams,
          daysCovered: targetDaysCovered,
          pointsEarned: scores.pointsEarned,
          badgeMinted: false,
          products: classification.products,
          ocrConfidence: ocrResult.confidence,
        },
      } as VerifyReceiptResponse);
      return;
    }

    // Step 3: Submit to smart contract (legacy fallback)
    const contractResult = await submitReceiptToContract({
      user: userAddress,
      totalItems: classification.totalItems,
      healthyItems: classification.healthyItems,
      unhealthyItems: classification.unhealthyItems,
      fruitVegGrams: classification.fruitVegGrams,
      householdSize,
      daysCovered: targetDaysCovered,
    });

    // Clear leaderboard cache to reflect new points immediately
    clearLeaderboardCache();

    const response: VerifyReceiptResponse = {
      success: true,
      data: {
        txHash: contractResult.txHash,
        healthScore: contractResult.healthScore,
        nutritionScore: contractResult.nutritionScore,
        totalItems: classification.totalItems,
        healthyItems: classification.healthyItems,
        unhealthyItems: classification.unhealthyItems,
        fruitVegGrams: classification.fruitVegGrams,
        daysCovered: contractResult.daysCovered,
        pointsEarned: contractResult.pointsEarned,
        badgeMinted: contractResult.badgeMinted,
        products: classification.products,
        ocrConfidence: ocrResult.confidence,
      },
    };

    res.json(response);
  } catch (error) {
    console.error("❌ Receipt verification failed:", error);

    if (error instanceof OCRError) {
      const status = error.code === "OCR_API_ERROR" ? 502 : 400;
      res.status(status).json({
        success: false,
        error: error.message,
        errorCode: error.code,
      } as VerifyReceiptResponse);
      return;
    }

    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Internal server error",
    } as VerifyReceiptResponse);
  }
});

// Helper: Estimate days covered based on items and household
function estimateDaysCovered(totalItems: number, householdSize: number): number {
  // Rough estimate: average household buys ~5 items per person per day
  const estimatedDays = Math.round(totalItems / (householdSize * 5));
  return Math.max(1, Math.min(7, estimatedDays)); // Clamp 1-7 days
}

export default router;

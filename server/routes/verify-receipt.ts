import { Router, Request, Response } from "express";
import { processOCR } from "../services/ocr.js";
import { classifyFoods, ClassificationResult } from "../services/classifier.js";
import { submitReceiptToContract } from "../services/contract.js";

const router = Router();

interface VerifyReceiptRequest {
  imageBase64: string;
  userAddress: string;
  householdSize: number;
  fid?: number; // Farcaster ID
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
  };
  error?: string;
}

router.post("/", async (req: Request, res: Response) => {
  try {
    const { imageBase64, userAddress, householdSize, fid } = req.body as VerifyReceiptRequest;

    // Validation
    if (!imageBase64) {
      res.status(400).json({ success: false, error: "Image is required" } as VerifyReceiptResponse);
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

    console.log(`📸 Processing receipt for ${userAddress}...`);

    // Step 1: OCR - Extract text from receipt
    const ocrResult = await processOCR(imageBase64);
    console.log(`📝 OCR found ${ocrResult.lines.length} lines`);

    // Step 2: Classify food items
    const classification = await classifyFoods(ocrResult.lines);
    console.log(`🥗 Classification: ${classification.healthyItems} healthy, ${classification.unhealthyItems} unhealthy`);

    // Step 3: Submit to smart contract
    const contractResult = await submitReceiptToContract({
      user: userAddress,
      totalItems: classification.totalItems,
      healthyItems: classification.healthyItems,
      unhealthyItems: classification.unhealthyItems,
      fruitVegGrams: classification.fruitVegGrams,
      householdSize,
      daysCovered: estimateDaysCovered(classification.totalItems, householdSize),
    });

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
      },
    };

    res.json(response);
  } catch (error) {
    console.error("❌ Receipt verification failed:", error);
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

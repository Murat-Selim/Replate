import { Router, Request, Response } from "express";
import { randomUUID } from "node:crypto";
import { processOCR, assertUsableOCR, OCRError } from "../services/ocr.js";
import { ClassificationResult } from "../services/classifier.js";
import { submitReceiptToContract, calculateScores } from "../services/contract.js";
import { createLegacyReceiptHash, createReceiptHash, isReceiptHashUsed } from "../services/receipt-hash.js";
import { clearLeaderboardCache } from "./leaderboard.js";
import { assertCompleteReceipt, ReceiptDateError, ReceiptQualityError, assertRecentReceiptDate, findReceiptDate } from "../services/receipt-date.js";
import { assertDatabaseConfigured, getDatabasePool } from "../db.js";
import { analyzeReceipt, assertReliableReceiptAnalysis, ReceiptAnalysisError, type ReceiptAnalysis } from "../services/receipt-analysis.js";
import { productSpendingCategory } from "../services/product-categorizer.js";
import { readReceiptWithDoubleword, pollReceiptWithDoubleword, validateDoublewordImage, OCRPendingError } from "../services/doubleword-ocr.js";

const router = Router();
// Temporarily disabled; set true when the receipt date window should be enforced again.
const ENABLE_RECEIPT_DATE_RANGE_CHECK = false;

interface VerifyReceiptRequest {
  imageBase64?: string;
  userAddress: string;
  householdSize: number;
  daysCovered?: number;
  fid?: number; // Farcaster ID
  onlyAnalyze?: boolean;
  pendingAnalysis?: { receiptHash: string; token: string };
}

interface VerifyReceiptResponse {
  success: boolean;
  data?: {
    txHash: string;
    receiptHash: string;
    receiptDate: string;
    healthScore: number;
    nutritionScore: number;
    totalItems: number;
    detectedItems: number;
    excludedItems: number;
    healthyItems: number;
    unhealthyItems: number;
    fruitVegGrams: number;
    daysCovered: number;
    householdSize?: number;
    pointsEarned: number;
    badgeMinted: boolean;
    products: ClassificationResult[];
    storeName?: string | null;
    currencyCode?: string | null;
    totalSpent?: number | null;
    totalSpentSource?: "receipt_total" | "line_items" | null;
    expectedItemsTotal?: number | null;
    /** Page confidence (0-1); zero means unknown for the secondary reader. */
    ocrConfidence: number;
    analysisMethod?: "vision-layout" | "vision-text" | "image-recovery";
  };
  error?: string;
  errorCode?: string;
  pendingAnalysis?: { receiptHash: string; token: string };
  retryAfterMs?: number;
}

interface RecoveryJob {
  token: string;
  responseId: string | null;
  receiptDate: string;
  legacyReceiptHash: string;
  householdSize: number;
  daysCovered?: number;
  startedAt: number;
  status: "starting" | "processing" | "failed" | "ready";
  error?: string;
  verificationResponse?: VerifyReceiptResponse;
}

async function loadRecoveryJob(receiptHash: string, userAddress: string): Promise<RecoveryJob | undefined> {
  assertDatabaseConfigured();
  const result = await getDatabasePool().query(
    "SELECT payload FROM receipt_analysis_staging WHERE receipt_hash = $1 AND user_wallet = $2 AND expires_at > NOW()",
    [receiptHash, userAddress.toLowerCase()],
  );
  return result.rows[0]?.payload?.doublewordJob;
}

async function saveRecoveryJob(receiptHash: string, userAddress: string, job: RecoveryJob): Promise<void> {
  await getDatabasePool().query(
    "UPDATE receipt_analysis_staging SET payload = jsonb_set(payload, '{doublewordJob}', $3::jsonb) WHERE receipt_hash = $1 AND user_wallet = $2",
    [receiptHash, userAddress.toLowerCase(), JSON.stringify(job)],
  );
}

router.post("/", async (req: Request, res: Response) => {
  let recoveryJob: RecoveryJob | undefined;
  /** True once this request claimed the job; only the owner can leave it unfinished. */
  let ownsRecoveryJob = false;
  let receiptHash = "";
  const userAddress = (req.body as VerifyReceiptRequest | undefined)?.userAddress;
  // An unfinished job blocks this receipt until the staging row expires, so record every terminal failure.
  const failRecoveryJob = async (message: string) => {
    if (!recoveryJob || !userAddress) return;
    recoveryJob.status = "failed";
    recoveryJob.error = message;
    delete recoveryJob.verificationResponse;
    await saveRecoveryJob(receiptHash, userAddress, recoveryJob).catch(() => undefined);
  };
  try {
    const { imageBase64, onlyAnalyze, pendingAnalysis } = req.body as VerifyReceiptRequest;
    let { householdSize, daysCovered } = req.body as VerifyReceiptRequest;
    if (!imageBase64 && !pendingAnalysis) {
      res.status(400).json({ success: false, error: "Image is required", errorCode: "OCR_INVALID_INPUT" });
      return;
    }
    if (!userAddress || !/^0x[a-fA-F0-9]{40}$/.test(userAddress)) {
      res.status(400).json({ success: false, error: "Valid user address is required" });
      return;
    }
    if (!pendingAnalysis && (!Number.isInteger(householdSize) || householdSize < 1 || householdSize > 10)) {
      res.status(400).json({ success: false, error: "Household size must be 1-10" });
      return;
    }
    let ocrResult: Awaited<ReturnType<typeof processOCR>> | undefined;
    let receiptDate: string;
    let legacyReceiptHash: string;
    if (pendingAnalysis) {
      if (!onlyAnalyze || !/^0x[a-fA-F0-9]{64}$/.test(pendingAnalysis.receiptHash) || !/^[a-f0-9-]{36}$/.test(pendingAnalysis.token)) {
        res.status(400).json({ success: false, error: "Invalid receipt analysis job" });
        return;
      }
      receiptHash = pendingAnalysis.receiptHash;
      recoveryJob = await loadRecoveryJob(receiptHash, userAddress);
      if (!recoveryJob || recoveryJob.token !== pendingAnalysis.token) {
        res.status(404).json({ success: false, error: "Receipt analysis job was not found or has expired" });
        return;
      }
      receiptDate = recoveryJob.receiptDate;
      legacyReceiptHash = recoveryJob.legacyReceiptHash;
    } else {
      ocrResult = await processOCR(imageBase64!);
      assertUsableOCR(ocrResult);
      receiptDate = assertRecentReceiptDate(ocrResult.lines, new Date(), ENABLE_RECEIPT_DATE_RANGE_CHECK);
      assertCompleteReceipt(ocrResult.lines);
      // An undated receipt keeps one identity; hashing today's date would let it be reused tomorrow.
      receiptHash = createReceiptHash(ocrResult.lines, findReceiptDate(ocrResult.lines) ?? "undated");
      legacyReceiptHash = createLegacyReceiptHash(ocrResult.lines);
      if (onlyAnalyze && process.env.OCR_API_KEY?.trim()) recoveryJob = await loadRecoveryJob(receiptHash, userAddress);
    }
    if (await isReceiptHashUsed(receiptHash) || await isReceiptHashUsed(legacyReceiptHash)) {
      res.status(409).json({ success: false, error: "This receipt has already been uploaded", errorCode: "RECEIPT_ALREADY_USED" });
      return;
    }

    const resumeJob = async (): Promise<ReceiptAnalysis> => {
      if (!recoveryJob || recoveryJob.status === "failed") {
        throw new OCRError(recoveryJob?.error || "Receipt OCR could not finish. Please upload a clearer photo.", "OCR_API_ERROR");
      }
      if (!recoveryJob.responseId) {
        if (Date.now() - recoveryJob.startedAt > 60000) {
          throw new OCRError("Receipt OCR submission could not be confirmed. Please contact support before retrying this receipt.", "OCR_API_ERROR");
        }
        throw new OCRPendingError("");
      }
      return pollReceiptWithDoubleword(recoveryJob.responseId);
    };
    if (recoveryJob?.verificationResponse) {
      res.json(recoveryJob.verificationResponse);
      return;
    }
    // Persist the job before submitting paid work; duplicate requests reuse it.
    const analysis = recoveryJob ? await resumeJob() : await analyzeReceipt(ocrResult!, onlyAnalyze && process.env.OCR_API_KEY?.trim()
      ? async () => {
        validateDoublewordImage(imageBase64!);
        recoveryJob = { token: randomUUID(), responseId: null, receiptDate, legacyReceiptHash,
          householdSize, daysCovered, startedAt: Date.now(), status: "starting" };
        assertDatabaseConfigured();
        await getDatabasePool().query("DELETE FROM receipt_analysis_staging WHERE expires_at < NOW()");
        const claim = await getDatabasePool().query(
          `INSERT INTO receipt_analysis_staging (receipt_hash, user_wallet, payload) VALUES ($1,$2,$3)
           ON CONFLICT (receipt_hash, user_wallet) DO UPDATE SET payload = EXCLUDED.payload
             WHERE NOT (receipt_analysis_staging.payload ? 'doublewordJob') RETURNING payload`,
          [receiptHash, userAddress.toLowerCase(), { doublewordJob: recoveryJob }],
        );
        if (!claim.rows.length) {
          recoveryJob = await loadRecoveryJob(receiptHash, userAddress);
          throw new OCRPendingError("");
        }
        ownsRecoveryJob = true;
        try {
          return await readReceiptWithDoubleword(imageBase64!);
        } catch (error) {
          if (error instanceof OCRPendingError) {
            recoveryJob.responseId = error.responseId;
            recoveryJob.status = "processing";
          } else {
            recoveryJob.status = "failed";
            recoveryJob.error = error instanceof OCRError ? error.message : "Receipt OCR could not finish";
          }
          await saveRecoveryJob(receiptHash, userAddress, recoveryJob);
          throw error;
        }
      } : undefined);
    assertReliableReceiptAnalysis(analysis);
    if (recoveryJob) {
      householdSize = recoveryJob.householdSize;
      daysCovered = recoveryJob.daysCovered;
    }
    const { classification, metadata: receiptMetadata } = analysis;
    // The secondary reader does not supply calibrated confidence; zero means unknown.
    const ocrConfidence = analysis.method === "image-recovery" ? 0 : ocrResult!.confidence;
    console.log(`ğŸ¥— Classification: ${classification.healthyItems} healthy, ${classification.unhealthyItems} unhealthy`);

    if (classification.totalItems === 0) {
      await failRecoveryJob("No food products found on this receipt. Try a full grocery receipt photo.");
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

      const products = classification.products.map((product) => ({
        ...product,
        spendingCategory: productSpendingCategory(product),
      }));
      const invalidProduct = products.length > 200 || products.some((product) => {
        const unitPrice = product.paidPrice === undefined ? null : product.actualWeightGrams > 0
          ? product.paidPrice * 1000 / product.actualWeightGrams
          : product.paidPrice / product.quantity;
        return product.name.length > 500 || product.quantity > 100000 || product.actualWeightGrams > 2147483647 ||
          (unitPrice !== null && unitPrice > 99999999.9999) || (product.paidPrice ?? 0) > 100000000;
      });
      if (invalidProduct || (receiptMetadata.totalSpent ?? 0) > 9999999999.99) {
        await failRecoveryJob("Receipt items or prices exceed supported limits");
        res.status(400).json({ success: false, error: "Receipt items or prices exceed supported limits", errorCode: "RECEIPT_DATA_OUT_OF_RANGE" });
        return;
      }
      const verificationResponse: VerifyReceiptResponse = {
        success: true,
        data: {
          txHash: "",
          receiptHash,
          receiptDate,
          healthScore: scores.healthScore,
          nutritionScore: scores.nutritionScore,
          totalItems: classification.totalItems,
          detectedItems: classification.detectedItems,
          excludedItems: classification.excludedItems,
          healthyItems: classification.healthyItems,
          unhealthyItems: classification.unhealthyItems,
          fruitVegGrams: classification.fruitVegGrams,
          householdSize,
          daysCovered: targetDaysCovered,
          pointsEarned: scores.pointsEarned,
          badgeMinted: false,
          products,
          ...receiptMetadata,
          ocrConfidence,
          analysisMethod: analysis.method,
        },
      };
      if (recoveryJob) {
        recoveryJob.status = "ready";
        recoveryJob.verificationResponse = verificationResponse;
      }
      assertDatabaseConfigured();
      await getDatabasePool().query("DELETE FROM receipt_analysis_staging WHERE expires_at < NOW()");
      await getDatabasePool().query(
        `INSERT INTO receipt_analysis_staging (receipt_hash, user_wallet, payload)
         VALUES ($1,$2,$3)
         ON CONFLICT (receipt_hash, user_wallet) DO UPDATE SET payload = EXCLUDED.payload,
           created_at = NOW(), expires_at = NOW() + INTERVAL '24 hours'`,
        [receiptHash, userAddress.toLowerCase(), {
          receiptDate,
          ocrConfidence,
          analysisMethod: analysis.method,
          products,
          ...receiptMetadata,
          totalItems: classification.totalItems,
          healthyItems: classification.healthyItems,
          unhealthyItems: classification.unhealthyItems,
          fruitVegGrams: classification.fruitVegGrams,
          householdSize,
          daysCovered: targetDaysCovered,
          ...(recoveryJob ? { doublewordJob: recoveryJob } : {}),
        }],
      );

      res.json(verificationResponse);
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
        receiptHash,
        receiptDate,
        healthScore: contractResult.healthScore,
        nutritionScore: contractResult.nutritionScore,
        totalItems: classification.totalItems,
        detectedItems: classification.detectedItems,
        excludedItems: classification.excludedItems,
        healthyItems: classification.healthyItems,
        unhealthyItems: classification.unhealthyItems,
        fruitVegGrams: classification.fruitVegGrams,
        daysCovered: contractResult.daysCovered,
        pointsEarned: contractResult.pointsEarned,
        badgeMinted: contractResult.badgeMinted,
        products: classification.products,
        ocrConfidence,
        analysisMethod: analysis.method,
      },
    };

    res.json(response);
  } catch (error) {
    if (error instanceof OCRPendingError && recoveryJob) {
      res.status(202).json({ success: true, pendingAnalysis: { receiptHash, token: recoveryJob.token }, retryAfterMs: 3000 });
      return;
    }
    if (!(error instanceof OCRPendingError) && (error instanceof ReceiptAnalysisError || ownsRecoveryJob)) {
      await failRecoveryJob(error instanceof OCRError || error instanceof ReceiptAnalysisError ? error.message : "Receipt OCR could not finish");
    }
    console.error("âŒ Receipt verification failed:", error);

    if (error instanceof OCRError) {
      const status = error.code === "OCR_API_ERROR" ? 502 : 400;
      res.status(status).json({
        success: false,
        error: error.message,
        errorCode: error.code,
      } as VerifyReceiptResponse);
      return;
    }

    if (error instanceof ReceiptAnalysisError) {
      res.status(422).json({ success: false, error: error.message, errorCode: error.code } as VerifyReceiptResponse);
      return;
    }

    if (error instanceof ReceiptDateError) {
      res.status(400).json({
        success: false,
        error: error.message,
        errorCode: error.code,
      } as VerifyReceiptResponse);
      return;
    }

    if (error instanceof ReceiptQualityError) {
      res.status(400).json({
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

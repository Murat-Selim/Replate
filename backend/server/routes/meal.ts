import { Router, Request, Response } from "express";
import { OCRError } from "../services/ocr.js";
import { analyzeMealPhoto } from "../services/meal-analysis.js";
import { getDatabasePool } from "../db.js";
import { MealPaymentError, mealPaymentInfo, runPaidMealAnalysis } from "../services/meal-payment.js";

const router = Router();

router.use((_req, res, next) => { res.set("Cache-Control", "private, no-store"); next(); });

router.get("/payment", async (_req, res) => {
  try {
    const payment = mealPaymentInfo();
    if (!process.env.OCR_API_KEY?.trim()) throw new Error("Meal analysis is not configured");
    await getDatabasePool().query("SELECT source_snapshot FROM x402_payments LIMIT 0");
    return res.json({ success: true, payment });
  } catch { return res.status(503).json({ success: false, error: "Meal analysis payments are unavailable" }); }
});

router.post("/", async (req: Request, res: Response) => {
  const imageBase64 = req.body?.imageBase64;
  if (!imageBase64) return res.status(400).json({ success: false, error: "Meal image is required" });

  try {
    const data = await runPaidMealAnalysis({ imageBase64, txHash: req.body?.txHash || "", payerAddress: req.body?.payerAddress || "" }, () => analyzeMealPhoto(imageBase64));
    if (!data) return res.status(202).json({ success: true, pending: true, retryAfterMs: 3000 });
    return res.json({ success: true, data });
  } catch (error) {
    if (error instanceof MealPaymentError) return res.status(error.status).json({ success: false, error: error.message, errorCode: error.code });
    if (error instanceof OCRError && error.code === "OCR_INVALID_INPUT") return res.status(422).json({ success: false, error: error.message });
    console.error("Meal analysis failed", error instanceof Error ? error.message : error);
    return res.status(502).json({ success: false, error: "Meal analysis is temporarily unavailable" });
  }
});

export default router;

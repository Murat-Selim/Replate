import { Router, Request, Response } from "express";
import { OCRError } from "../services/ocr.js";
import { analyzeMealPhoto } from "../services/meal-analysis.js";
import { x402Configured } from "../services/x402.js";

const router = Router();

router.post("/", async (req: Request, res: Response) => {
  if (!x402Configured) return res.status(503).json({ success: false, error: "Meal analysis payments are unavailable" });
  const imageBase64 = req.body?.imageBase64;
  if (!imageBase64) return res.status(400).json({ success: false, error: "Meal image is required" });

  try {
    // Error responses are not settled by x402, so a photo without food is not charged.
    return res.json({ success: true, data: await analyzeMealPhoto(imageBase64) });
  } catch (error) {
    if (error instanceof OCRError && error.code === "OCR_INVALID_INPUT") return res.status(422).json({ success: false, error: error.message });
    console.error("Meal analysis failed", error instanceof Error ? error.message : error);
    return res.status(502).json({ success: false, error: "Meal analysis is temporarily unavailable" });
  }
});

export default router;

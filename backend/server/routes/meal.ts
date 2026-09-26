import { Router, Request, Response } from "express";
import { getVisionClient, validateImageBase64 } from "../services/ocr.js";
import { x402Configured } from "../services/x402.js";

const router = Router();

const componentRules = [
  { key: "vegetables", words: ["vegetable", "salad", "broccoli", "tomato", "carrot", "green bean", "cucumber"] },
  { key: "fruit", words: ["fruit", "apple", "banana", "berry", "orange"] },
  { key: "protein", words: ["meat", "chicken", "fish", "egg", "seafood", "tofu"] },
  { key: "whole_food_carbs", words: ["rice", "bread", "pasta", "grain", "potato", "oat"] },
  { key: "sugary_or_processed", words: ["dessert", "cake", "cookie", "candy", "pizza", "french fries", "fast food"] },
];

router.post("/", async (req: Request, res: Response) => {
  if (!x402Configured) return res.status(503).json({ success: false, error: "Meal analysis payments are unavailable" });
  const imageBase64 = req.body?.imageBase64;
  if (!imageBase64) return res.status(400).json({ success: false, error: "Meal image is required" });

  try {
    const content = validateImageBase64(imageBase64);
    const [visionResult] = await getVisionClient().labelDetection({ image: { content } });
    const labels = (visionResult.labelAnnotations || [])
      .filter((label) => label.description && Number(label.score || 0) >= 0.5)
      .map((label) => ({ label: label.description as string, confidence: Number(label.score || 0) }));
    const labelText = labels.map(({ label }) => label.toLowerCase()).join(" ");
    const components = componentRules.filter((rule) => rule.words.some((word) => labelText.includes(word))).map((rule) => rule.key);
    const positive = components.filter((component) => ["vegetables", "fruit", "protein", "whole_food_carbs"].includes(component)).length;
    const hasProcessed = components.includes("sugary_or_processed");
    const balanceScore = Math.max(0, Math.min(100, 45 + positive * 14 - (hasProcessed ? 12 : 0)));

    return res.json({
      success: true,
      data: {
        detectedLabels: labels.slice(0, 8),
        components,
        balanceScore,
        confidence: labels.length ? Math.round((labels.reduce((sum, item) => sum + item.confidence, 0) / labels.length) * 100) / 100 : 0,
        insight: positive >= 3 ? "This meal shows a useful mix of food groups." : "This meal has a clear starting point for better balance.",
        recommendation: hasProcessed ? "Add a vegetable, fruit or protein-rich side next time." : positive < 3 ? "Try adding one missing food group for more balance." : "Keep rotating colors, textures and whole-food ingredients.",
        informationalOnly: true,
      },
    });
  } catch (error) {
    console.error("Meal analysis failed", error);
    return res.status(502).json({ success: false, error: "Meal analysis is temporarily unavailable" });
  }
});

export default router;

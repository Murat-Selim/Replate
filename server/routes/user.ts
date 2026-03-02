import { Router, Request, Response } from "express";
import { getUserSummary, submitCheckIn } from "../services/contract.js";

const router = Router();

// Get user summary
router.get("/:address", async (req: Request, res: Response) => {
  try {
    const address = req.params.address as string;

    if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
      res.status(400).json({ success: false, error: "Invalid address" });
      return;
    }

    const summary = await getUserSummary(address);

    res.json({
      success: true,
      data: summary,
    });
  } catch (error) {
    console.error("❌ User summary fetch failed:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Internal server error",
    });
  }
});

// Get current week report
router.get("/:address/week", async (req: Request, res: Response) => {
  try {
    const address = req.params.address as string;

    if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
      res.status(400).json({ success: false, error: "Invalid address" });
      return;
    }

    // For now, return mock data since getCurrentWeekReport not implemented
    res.json({
      success: true,
      data: {
        weekPoints: 0,
        receiptCount: 0,
        avgHealthScore: 0,
        avgNutritionScore: 0,
      },
    });
  } catch (error) {
    console.error("❌ Week report fetch failed:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Internal server error",
    });
  }
});

// Submit daily check-in
router.post("/check-in", async (req: Request, res: Response) => {
  try {
    const { userAddress } = req.body as { userAddress: string };

    if (!userAddress || !/^0x[a-fA-F0-9]{40}$/.test(userAddress)) {
      res.status(400).json({ success: false, error: "Valid user address is required" });
      return;
    }

    const result = await submitCheckIn(userAddress);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("❌ Check-in failed:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Internal server error",
    });
  }
});

export default router;

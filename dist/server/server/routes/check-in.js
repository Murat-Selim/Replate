import { Router } from "express";
import { submitCheckIn } from "../services/contract.js";
const router = Router();
router.post("/", async (req, res) => {
    try {
        const { userAddress } = req.body;
        if (!userAddress || !/^0x[a-fA-F0-9]{40}$/.test(userAddress)) {
            res.status(400).json({ success: false, error: "Valid user address is required" });
            return;
        }
        console.log(`📍 Processing check-in for ${userAddress}...`);
        const result = await submitCheckIn(userAddress);
        const response = {
            success: true,
            data: {
                pointsEarned: result.pointsEarned,
                newStreak: 1, // This would come from the contract in production
            },
        };
        res.json(response);
    }
    catch (error) {
        console.error("❌ Check-in failed:", error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : "Internal server error",
        });
    }
});
export default router;

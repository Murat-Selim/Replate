import { Router } from "express";
import { getUserSummary, submitCheckIn, getUserWeekReport } from "../services/contract.js";
const router = Router();
// Get user summary
router.get("/:address", async (req, res) => {
    try {
        const address = req.params.address;
        if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
            res.status(400).json({ success: false, error: "Invalid address" });
            return;
        }
        const summary = await getUserSummary(address);
        const weekReport = await getUserWeekReport(address);
        res.json({
            success: true,
            data: {
                ...summary,
                weekReport,
            },
        });
    }
    catch (error) {
        console.error("❌ User summary fetch failed:", error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : "Internal server error",
        });
    }
});
// Get current week report
router.get("/:address/week", async (req, res) => {
    try {
        const address = req.params.address;
        if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
            res.status(400).json({ success: false, error: "Invalid address" });
            return;
        }
        const report = await getUserWeekReport(address);
        res.json({
            success: true,
            data: report,
        });
    }
    catch (error) {
        console.error("❌ Week report fetch failed:", error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : "Internal server error",
        });
    }
});
// Submit daily check-in
router.post("/check-in", async (req, res) => {
    try {
        const { userAddress } = req.body;
        if (!userAddress || !/^0x[a-fA-F0-9]{40}$/.test(userAddress)) {
            res.status(400).json({ success: false, error: "Valid user address is required" });
            return;
        }
        const result = await submitCheckIn(userAddress);
        res.json({
            success: true,
            data: result,
        });
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

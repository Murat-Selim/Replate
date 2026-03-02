import { Router, Request, Response } from "express";
import { submitCheckIn } from "../services/contract.js";

const router = Router();

interface CheckInRequest {
    userAddress: string;
}

interface CheckInResponse {
    success: boolean;
    data?: {
        pointsEarned: number;
        newStreak: number;
    };
    error?: string;
}

router.post("/", async (req: Request, res: Response) => {
    try {
        const { userAddress } = req.body as CheckInRequest;

        if (!userAddress || !/^0x[a-fA-F0-9]{40}$/.test(userAddress)) {
            res.status(400).json({ success: false, error: "Valid user address is required" } as CheckInResponse);
            return;
        }

        console.log(`📍 Processing check-in for ${userAddress}...`);

        const result = await submitCheckIn(userAddress);

        const response: CheckInResponse = {
            success: true,
            data: {
                pointsEarned: result.pointsEarned,
                newStreak: 1, // This would come from the contract in production
            },
        };

        res.json(response);
    } catch (error) {
        console.error("❌ Check-in failed:", error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : "Internal server error",
        } as CheckInResponse);
    }
});

export default router;

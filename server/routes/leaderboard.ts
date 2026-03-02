import { Router, Request, Response } from "express";
import { ethers } from "ethers";
import { REPLATE_QUEST_ABI, CONTRACT_ADDRESS } from "../../src/lib/contract";

const router = Router();

interface LeaderboardEntry {
  rank: number;
  address: string;
  totalPoints: number;
  level: number;
  streak: number;
  hasBadge: boolean;
}

// In-memory cache with TTL
let cachedLeaderboard: LeaderboardEntry[] | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

router.get("/", async (req: Request, res: Response) => {
  try {
    // Check cache
    if (cachedLeaderboard && Date.now() - cacheTimestamp < CACHE_TTL) {
      res.json({ success: true, data: cachedLeaderboard, cached: true });
      return;
    }

    // For now, return mock data until contract is deployed
    // In production, this would query the contract events or a subgraph
    const mockLeaderboard: LeaderboardEntry[] = [
      { rank: 1, address: "0x1234...5678", totalPoints: 12500, level: 25, streak: 8, hasBadge: true },
      { rank: 2, address: "0x2345...6789", totalPoints: 10200, level: 20, streak: 5, hasBadge: true },
      { rank: 3, address: "0x3456...7890", totalPoints: 8500, level: 17, streak: 3, hasBadge: true },
      { rank: 4, address: "0x4567...8901", totalPoints: 7200, level: 14, streak: 2, hasBadge: false },
      { rank: 5, address: "0x5678...9012", totalPoints: 6500, level: 13, streak: 1, hasBadge: false },
    ];

    cachedLeaderboard = mockLeaderboard;
    cacheTimestamp = Date.now();

    res.json({ success: true, data: mockLeaderboard, cached: false });
  } catch (error) {
    console.error("❌ Leaderboard fetch failed:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Internal server error",
    });
  }
});

// Get user's rank
router.get("/rank/:address", async (req: Request, res: Response) => {
  try {
    const address = req.params.address as string;

    if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
      res.status(400).json({ success: false, error: "Invalid address" });
      return;
    }

    // Mock response - in production, query contract
    res.json({
      success: true,
      data: {
        address,
        rank: 42,
        totalPoints: 3500,
        level: 7,
        streak: 2,
        hasBadge: false,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Internal server error",
    });
  }
});

export default router;

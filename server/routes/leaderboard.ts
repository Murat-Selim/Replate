import { Router, Request, Response } from "express";
import { getLeaderboard, getUserRank, getPoolStatus, LeaderboardEntry } from "../services/contract.js";

const router = Router();

type LeaderboardEntryWithRank = LeaderboardEntry & { rank: number };

// In-memory cache with TTL - SET TO 1S FOR DEBUGGING
export let cachedLeaderboard: LeaderboardEntryWithRank[] | null = null;
export let cacheTimestamp = 0;
const CACHE_TTL = 1000; // 1 second

export function clearLeaderboardCache() {
  cachedLeaderboard = null;
  cacheTimestamp = 0;
}

// Add rank to leaderboard entries
function addRanks(entries: LeaderboardEntry[]): LeaderboardEntryWithRank[] {
  return entries.map((entry, index) => ({
    ...entry,
    rank: index + 1,
  }));
}

router.get("/", async (req: Request, res: Response) => {
  try {
    // Check cache - DISABLED FOR DEBUGGING
    if (false && cachedLeaderboard && Date.now() - cacheTimestamp < CACHE_TTL) {
      const poolStatus = await getPoolStatus();
      res.json({ success: true, data: cachedLeaderboard, poolStatus, cached: true });
      return;
    }

    // Query contract for leaderboard
    const leaderboard = await getLeaderboard(100);
    const leaderboardWithRanks = addRanks(leaderboard);

    cachedLeaderboard = leaderboardWithRanks;
    cacheTimestamp = Date.now();

    // Also get pool status
    const poolStatus = await getPoolStatus();

    res.json({ success: true, data: leaderboardWithRanks, poolStatus, cached: false });
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

    // Get user's data from contract
    const userData = await getUserRank(address);
    
    if (!userData) {
      res.json({
        success: true,
        data: {
          address,
          rank: 0,
          totalPoints: 0,
          level: 0,
          streak: 0,
          hasBadge: false,
        },
      });
      return;
    }

    // Calculate rank by comparing with leaderboard
    const leaderboard = await getLeaderboard(1000);
    const rank = leaderboard.findIndex(entry => 
      entry.address.toLowerCase() === address.toLowerCase()
    ) + 1;

    res.json({
      success: true,
      data: {
        address: userData.address,
        rank,
        totalPoints: userData.totalPoints,
        level: userData.level,
        streak: userData.streak,
        hasBadge: userData.hasBadge,
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

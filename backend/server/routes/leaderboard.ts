import { Router, Request, Response } from "express";
import {
  getLeaderboard,
  getUserRank,
  getPoolStatus,
  LeaderboardEntry,
} from "../services/contract.js";

const router = Router();

type LeaderboardEntryWithRank = LeaderboardEntry & { rank: number };

// ─── Cache ────────────────────────────────────────────────────────────
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

interface LeaderboardCache {
  entries: LeaderboardEntryWithRank[];
  poolStatus: Awaited<ReturnType<typeof getPoolStatus>>;
  timestamp: number;
}

let cache: LeaderboardCache | null = null;
let isRefreshing = false;

export function clearLeaderboardCache(): void {
  cache = null;
}

function isCacheValid(): boolean {
  return cache !== null && Date.now() - cache.timestamp < CACHE_TTL;
}

/**
 * Refresh the cache in the background. If a refresh is already in progress,
 * this is a no-op. Returns immediately without blocking.
 */
async function refreshCacheInBackground(): Promise<void> {
  if (isRefreshing) return;
  isRefreshing = true;
  const startTime = Date.now();

  try {
    console.log("🔄 Refreshing leaderboard cache in background...");
    const [entries, poolStatus] = await Promise.all([
      getLeaderboard(1000),
      getPoolStatus(),
    ]);

    cache = {
      entries: entries.map((entry, i) => ({ ...entry, rank: i + 1 })),
      poolStatus,
      timestamp: Date.now(),
    };

    console.log(`✅ Leaderboard cache refreshed (${entries.length} entries, ${((Date.now() - startTime) / 1000).toFixed(1)}s)`);
  } catch (error) {
    console.error("❌ Background leaderboard refresh failed:", error);
  } finally {
    isRefreshing = false;
  }
}

/**
 * Get the cached data. Uses stale-while-revalidate pattern:
 * - If cache is valid → return it
 * - If cache is stale but exists → return stale data AND trigger background refresh
 * - If no cache exists → do an initial fetch (blocks)
 */
async function getOrRefreshCache(): Promise<LeaderboardCache> {
  // Cache is still fresh
  if (isCacheValid()) return cache!;

  // Cache exists but is stale — return stale data, refresh in background
  if (cache !== null) {
    refreshCacheInBackground(); // fire-and-forget
    return cache;
  }

  // No cache at all — must wait for the first fetch
  await refreshCacheInBackground();

  if (cache) return cache;

  // Fallback: return empty data if the refresh failed completely
  return {
    entries: [],
    poolStatus: { weeklyPool: 0, devFund: 0, currentPhase: 0 },
    timestamp: 0,
  };
}

/**
 * Warm the cache on server startup. Call this once during init.
 */
export function warmLeaderboardCache(): void {
  console.log("🔥 Warming leaderboard cache on startup...");
  refreshCacheInBackground();
}

// ─── GET / ────────────────────────────────────────────────────────────
router.get("/", async (req: Request, res: Response) => {
  try {
    const wasValid = isCacheValid();
    const { entries, poolStatus } = await getOrRefreshCache();

    res.json({
      success: true,
      data: entries,
      poolStatus,
      cached: wasValid,
    });
  } catch (error) {
    console.error("❌ Leaderboard fetch failed:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Internal server error",
    });
  }
});

// ─── GET /rank/:address ───────────────────────────────────────────────
router.get("/rank/:address", async (req: Request, res: Response) => {
  try {
    const address = req.params.address as string;

    if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
      res.status(400).json({ success: false, error: "Invalid address" });
      return;
    }

    const normalizedAddress = address.toLowerCase();


    const [userData, { entries }] = await Promise.all([
      getUserRank(normalizedAddress),
      getOrRefreshCache(),
    ]);

    if (!userData) {
      res.json({
        success: true,
        data: {
          address,
          rank: null,
          totalPoints: 0,
          level: 0,
          streak: 0,
          hasBadge: false,
          totalCheckIns: 0,
          receiptCount: 0,
        },
      });
      return;
    }

    const index = entries.findIndex(
      (e) => e.address.toLowerCase() === normalizedAddress
    );

    res.json({
      success: true,
      data: {
        address: userData.address,
        rank: index === -1 ? null : index + 1,
        totalPoints: userData.totalPoints,
        level: userData.level,
        streak: userData.streak,
        hasBadge: userData.hasBadge,
        totalCheckIns: userData.totalCheckIns,
        receiptCount: userData.receiptCount,
      },
    });
  } catch (error) {
    console.error("❌ User rank fetch failed:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Internal server error",
    });
  }
});

export default router;
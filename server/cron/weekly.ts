import { getLeaderboard, finalizeUserWeek, distributeWeeklyRewards } from "../services/contract.js";

/**
 * Run weekly finalization for top users
 * Called by cron job every Sunday at 00:00 UTC
 */
export async function runWeeklyFinalization(): Promise<void> {
  console.log(`🔄 Starting weekly finalization and reward distribution...`);

  // 1. Get top users from the live leaderboard (up to 100)
  // This replaces the in-memory activeUsers for stateless Vercel operation
  const top100 = await getLeaderboard(100);

  if (top100.length === 0) {
    console.log("⚠️ No users found in leaderboard to finalize or distribute rewards to");
    return;
  }

  console.log(`📈 Processing ${top100.length} top users...`);

  const results: { user: string; success: boolean; streak: number }[] = [];

  // 2. Finalize each top user's week (calculate streaks, give bonuses)
  for (const entry of top100) {
    try {
      const result = await finalizeUserWeek(entry.address);
      results.push({ user: entry.address, success: result.success, streak: result.newStreak });
      console.log(`✅ Finalized week for ${entry.address}: streak ${result.newStreak}`);
    } catch (error) {
      console.warn(`⚠️ Failed to finalize week for ${entry.address}:`, error);
      // Continue to others
    }
  }

  // 3. Calculate shares for USDC distribution (proportional to their total points)
  const totalPoints = top100.reduce((sum, u) => sum + u.totalPoints, 0);
  
  if (totalPoints === 0) {
    console.log("⚠️ Total points is zero, skipping distribution");
    return;
  }

  // Shares are proportional to their contribution to total points
  const shares = top100.map(u => BigInt(u.totalPoints));

  // 4. Call the smart contract to distribute the USDC pool
  try {
    console.log(`💰 Distributing weekly pool to ${top100.length} users...`);
    const result = await distributeWeeklyRewards(
      top100.map(u => u.address),
      shares
    );
    console.log(`✅ Reward distribution transaction successful!`);
  } catch (error) {
    console.error("❌ Failed to distribute rewards on-chain:", error);
  }

  // Log summary
  console.log(`📊 Weekly summary:
    - Users processed: ${top100.length}
    - Top user: ${top100[0]?.address} (${top100[0]?.totalPoints} XP)
    - Combined points in pool: ${totalPoints}
  `);
}

/**
 * Register a user for weekly tracking (legacy, kept for compatibility)
 */
export function registerUser(userAddress: string) {
  // Now handled dynamically by getLeaderboard
}

/**
 * Get list of active users (legacy, kept for compatibility)
 */
export function getActiveUsers(): string[] {
  return [];
}

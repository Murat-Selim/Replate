import { getLeaderboard, finalizeUserWeek, distributeWeeklyRewards } from "../services/contract.js";

/**
 * Run weekly finalization for top users
 * Called by cron job every Sunday at 00:00 UTC
 */
export async function runWeeklyFinalization(): Promise<void> {
  console.log(`ğŸ”„ Starting weekly finalization and reward distribution...`);

  // 1. Get top users from the live leaderboard (up to 100)
  // This replaces the in-memory activeUsers for stateless Vercel operation
  const top100 = await getLeaderboard(100);

  if (top100.length === 0) {
    console.log("âš ï¸ No users found in leaderboard to finalize or distribute rewards to");
    return;
  }

  console.log(`ğŸ“ˆ Processing ${top100.length} top users...`);

  const results: { user: string; success: boolean; streak: number }[] = [];
  const failures: string[] = [];

  // 2. Finalize each top user's week (calculate streaks, give bonuses)
  for (const entry of top100) {
    try {
      const result = await finalizeUserWeek(entry.address);
      results.push({ user: entry.address, success: result.success, streak: result.newStreak });
      console.log(`âœ… Finalized week for ${entry.address}: streak ${result.newStreak}`);
    } catch (error) {
      console.warn(`âš ï¸ Failed to finalize week for ${entry.address}:`, error);
      failures.push(entry.address);
    }
  }

  // 3. Calculate shares for USDC distribution (proportional to their total points)
  const totalPoints = top100.reduce((sum, u) => sum + u.totalPoints, 0);
  
  if (totalPoints === 0) {
    console.log("âš ï¸ Total points is zero, skipping distribution");
    return;
  }

  // Shares are proportional to their contribution to total points
  const shares = top100.map(u => BigInt(u.totalPoints));

  // 4. Call the smart contract to distribute the USDC pool
  try {
    console.log(`ğŸ’° Distributing weekly pool to ${top100.length} users...`);
    const result = await distributeWeeklyRewards(
      top100.map(u => u.address),
      shares
    );
    console.log(`âœ… Reward distribution transaction successful!`);
  } catch (error) {
    console.error("âŒ Failed to distribute rewards on-chain:", error);
    throw new Error(`Weekly reward distribution failed: ${error instanceof Error ? error.message : "unknown error"}`);
  }

  // Log summary
  console.log(`ğŸ“Š Weekly summary:
    - Users processed: ${top100.length}
    - Top user: ${top100[0]?.address} (${top100[0]?.totalPoints} XP)
    - Combined points in pool: ${totalPoints}
  `);

  if (failures.length > 0) {
    throw new Error(`Weekly finalization incomplete for ${failures.length} user(s)`);
  }
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

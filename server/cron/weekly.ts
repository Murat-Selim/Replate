import { getUserSummary, finalizeUserWeek, distributeWeeklyRewards } from "../services/contract.js";

// In-memory store for tracking users (in production, use a database)
// This would be replaced with proper user tracking from events
const activeUsers = new Set<string>();

/**
 * Register a user for weekly tracking
 */
export function registerUser(userAddress: string) {
  activeUsers.add(userAddress);
}

/**
 * Run weekly finalization for all active users
 * Called by cron job every Sunday at 00:00 UTC
 */
export async function runWeeklyFinalization(): Promise<void> {
  console.log(`🔄 Starting weekly finalization for ${activeUsers.size} users...`);

  const results: { user: string; success: boolean; streak: number }[] = [];

  // Finalize each user's week
  for (const user of activeUsers) {
    try {
      const result = await finalizeUserWeek(user);
      results.push({ user, success: result.success, streak: result.newStreak });
      console.log(`✅ Finalized week for ${user}: streak ${result.newStreak}`);
    } catch (error) {
      console.error(`❌ Failed to finalize ${user}:`, error);
      results.push({ user, success: false, streak: 0 });
    }
  }

  // Calculate top 100 by total points
  const userPoints: { user: string; points: number }[] = [];

  for (const user of activeUsers) {
    try {
      const summary = await getUserSummary(user);
      userPoints.push({ user, points: summary.totalPoints });
    } catch (error) {
      console.error(`❌ Failed to get summary for ${user}:`, error);
    }
  }

  // Sort by points and take top 100
  const top100 = userPoints
    .sort((a, b) => b.points - a.points)
    .slice(0, 100);

  if (top100.length === 0) {
    console.log("⚠️ No users to distribute rewards to");
    return;
  }

  // Calculate shares (proportional to points)
  const totalPoints = top100.reduce((sum, u) => sum + u.points, 0);
  const shares = top100.map(u => BigInt(Math.floor((u.points * 1e18) / totalPoints)));

  // Distribute rewards
  try {
    const result = await distributeWeeklyRewards(
      top100.map(u => u.user),
      shares
    );
    console.log(`💰 Distributed rewards: ${result.totalDistributed} wei to ${top100.length} users`);
  } catch (error) {
    console.error("❌ Failed to distribute rewards:", error);
  }

  // Log summary
  console.log(`📊 Weekly summary:
    - Users finalized: ${results.filter(r => r.success).length}/${results.length}
    - Top user: ${top100[0]?.user} (${top100[0]?.points} points)
    - Total points distributed: ${totalPoints}
  `);
}

/**
 * Get list of active users (for testing/debugging)
 */
export function getActiveUsers(): string[] {
  return Array.from(activeUsers);
}

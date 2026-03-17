import { ethers, Wallet, Contract } from "ethers";
import { REPLATE_QUEST_ABI, CONTRACT_ADDRESS } from "../../src/lib/contract.js";

// Provider and wallet setup
let provider: ethers.JsonRpcProvider | null = null;
let wallet: Wallet | null = null;
let contract: Contract | null = null;

interface ReceiptSubmission {
  user: string;
  totalItems: number;
  healthyItems: number;
  unhealthyItems: number;
  fruitVegGrams: number;
  householdSize: number;
  daysCovered: number;
}

interface ContractResult {
  healthScore: number;
  nutritionScore: number;
  pointsEarned: number;
  daysCovered: number;
  txHash: string;
  badgeMinted: boolean;
}

function getContract(): Contract {
  if (!contract) {
    const rpcUrl = process.env.RPC_URL || process.env.BASE_SEPOLIA_RPC_URL;
    const privateKey = process.env.VALIDATOR_PRIVATE_KEY || process.env.PRIVATE_KEY;

    if (!rpcUrl || !privateKey) {
      throw new Error("Missing RPC_URL or VALIDATOR_PRIVATE_KEY in environment");
    }

    provider = new ethers.JsonRpcProvider(rpcUrl);
    wallet = new Wallet(privateKey, provider);
    contract = new Contract(process.env.CONTRACT_ADDRESS || CONTRACT_ADDRESS, REPLATE_QUEST_ABI, wallet);
  }

  return contract;
}

/**
 * Submit a verified receipt to the smart contract
 */
export async function submitReceiptToContract(data: ReceiptSubmission): Promise<ContractResult> {
  // Check if we have valid RPC URL and private key
  const rpcUrl = process.env.RPC_URL || process.env.BASE_SEPOLIA_RPC_URL;
  const privateKey = process.env.VALIDATOR_PRIVATE_KEY || process.env.PRIVATE_KEY;

  if (!rpcUrl || !privateKey) {
    console.log("⚠️ Contract not configured, using mock response");
    return mockContractResponse(data);
  }

  try {
    const c = getContract();

    // Call submitReceipt on contract
    const tx = await c.submitReceipt(
      data.user,
      data.totalItems,
      data.healthyItems,
      data.unhealthyItems,
      data.fruitVegGrams,
      data.householdSize,
      data.daysCovered
    );

    console.log(`📤 Transaction sent: ${tx.hash}`);

    // Wait for confirmation
    const receipt = await tx.wait();
    console.log(`✅ Transaction confirmed in block ${receipt.blockNumber}`);

    // Parse events to get the result
    const receiptEvent = receipt.logs.find((log: { topics: string[] }) =>
      log.topics[0] === ethers.id("ReceiptSubmitted(address,uint8,uint8,uint256,uint16,uint16)")
    );

    const badgeMinted = !!receipt.logs.find((log: { topics: string[] }) =>
      log.topics[0] === ethers.id("BadgeMinted(address,uint256)")
    );

    if (receiptEvent) {
      const decoded = ethers.AbiCoder.defaultAbiCoder().decode(
        ["uint8", "uint8", "uint256", "uint16", "uint16"],
        receiptEvent.data
      );

      return {
        healthScore: Number(decoded[0]),
        nutritionScore: Number(decoded[1]),
        pointsEarned: Number(decoded[2]),
        daysCovered: data.daysCovered,
        txHash: tx.hash,
        badgeMinted,
      };
    }

    // Fallback calculation if event not found
    return calculateScores(data);
  } catch (error: any) {
    console.error("❌ Contract submission failed:", error);

    // Extract the revert reason if available
    let message = "Failed to submit receipt to blockchain";
    if (error?.revert?.args?.[0]) {
      message = error.revert.args[0];
    } else if (error?.reason) {
      message = error.reason;
    } else if (error?.message) {
      // Basic cleaning for common strings
      if (error.message.includes("Already submitted")) {
        message = "Already submitted a receipt today";
      } else {
        message = error.message;
      }
    }

    throw new Error(message);
  }
}

/**
 * Submit daily check-in for a user
 */
export async function submitCheckIn(userAddress: string): Promise<{ success: boolean; pointsEarned: number }> {
  const rpcUrl = process.env.RPC_URL || process.env.BASE_SEPOLIA_RPC_URL;
  const privateKey = process.env.VALIDATOR_PRIVATE_KEY || process.env.PRIVATE_KEY;

  if (!rpcUrl || !privateKey) {
    return { success: true, pointsEarned: 10 };
  }

  try {
    const c = getContract();

    // Check if user already checked in today before sending transaction
    let lastDay = 0;
    try {
      const lastDayVal = await c.lastCheckInDay(userAddress);
      lastDay = Number(lastDayVal || 0);
    } catch (e) {
      console.warn("⚠️ Could not fetch lastCheckInDay in submitCheckIn, proceeding anyway");
    }

    const today = Math.floor(Date.now() / 1000 / 86400);
    if (lastDay >= today) {
      throw new Error("Already checked in today");
    }

    console.log(`🔗 Initiating contract check-in for ${userAddress}...`);
    const tx = await c.checkIn(userAddress);
    console.log(`📤 Check-in transaction sent: ${tx.hash}`);

    await tx.wait();
    console.log(`✅ Check-in transaction confirmed for ${userAddress}`);

    return { success: true, pointsEarned: 10 };
  } catch (error: any) {
    console.error("❌ Check-in failed in contract service:", error);
    // Sanitize the error message to avoid technical ethers dump on screen
    let message = error?.message || "Check-in failed";
    if (message.includes("BAD_DATA") || message.includes("decode")) {
      message = "Blockchain connection issue. Please try again later.";
    }
    throw new Error(message);
  }
}

/**
 * Finalize a user's weekly streak
 */
export async function finalizeUserWeek(userAddress: string): Promise<{ success: boolean; newStreak: number }> {
  const rpcUrl = process.env.RPC_URL || process.env.BASE_SEPOLIA_RPC_URL;
  const privateKey = process.env.VALIDATOR_PRIVATE_KEY || process.env.PRIVATE_KEY;

  if (!rpcUrl || !privateKey) {
    return { success: true, newStreak: 1 };
  }

  try {
    const c = getContract();
    const tx = await c.finalizeWeek(userAddress);
    const receipt = await tx.wait();

    // Parse event for new streak
    const event = receipt.logs.find((log: { topics: string[] }) =>
      log.topics[0] === ethers.id("WeekFinalized(address,uint256,uint256,uint256)")
    );

    if (event) {
      const decoded = ethers.AbiCoder.defaultAbiCoder().decode(
        ["uint256", "uint256", "uint256"],
        event.data
      );
      return { success: true, newStreak: Number(decoded[2]) };
    }

    return { success: true, newStreak: 0 };
  } catch (error) {
    console.error("❌ Week finalization failed:", error);
    throw error;
  }
}

/**
 * Distribute weekly rewards to top users
 */
export async function distributeWeeklyRewards(
  topUsers: string[],
  shares: bigint[]
): Promise<{ success: boolean; totalDistributed: bigint }> {
  const rpcUrl = process.env.RPC_URL || process.env.BASE_SEPOLIA_RPC_URL;
  const privateKey = process.env.VALIDATOR_PRIVATE_KEY || process.env.PRIVATE_KEY;

  if (!rpcUrl || !privateKey) {
    return { success: true, totalDistributed: BigInt(0) };
  }

  try {
    const c = getContract();
    const tx = await c.distributeWeeklyRewards(topUsers, shares);
    await tx.wait();

    return { success: true, totalDistributed: BigInt(0) };
  } catch (error) {
    console.error("❌ Reward distribution failed:", error);
    throw error;
  }
}

/**
 * Get user summary from contract
 */
export async function getUserSummary(userAddress: string) {
  const rpcUrl = process.env.RPC_URL || process.env.BASE_SEPOLIA_RPC_URL;
  const privateKey = process.env.VALIDATOR_PRIVATE_KEY || process.env.PRIVATE_KEY;

  if (!rpcUrl || !privateKey) {
    console.log("⚠️ RPC_URL or private key missing, returning empty summary");
    return {
      totalPoints: 0,
      level: 0,
      receiptStreak: 0,
      checkInStreak: 0,
      totalCheckIns: 0,
      receiptCount: 0,
      hasBadge: false,
      lastCheckInDay: 0,
    };
  }

  try {
    const c = getContract();
    console.log(`📡 Calling contract at: ${c.target} for user: ${userAddress}`);

    let summary: any = { _totalPoints: 0, _level: 0, _receiptStreak: 0, _checkInStreak: 0, _totalCheckIns: 0, _receiptCount: 0, _hasBadge: false };
    try {
      // Use raw call or wrap in a way that catches BAD_DATA
      summary = await c.getUserSummary(userAddress);
    } catch (e: any) {
      console.error("❌ Failed to call getUserSummary:", e.message || e);
    }

    let lastCheckInDay = 0;
    try {
      const lastDayVal = await c.lastCheckInDay(userAddress);
      lastCheckInDay = Number(lastDayVal || 0);
    } catch (e: any) {
      console.warn("⚠️ Failed to call lastCheckInDay:", e.message || e);
    }

    return {
      totalPoints: Number(summary?._totalPoints || 0),
      level: Number(summary?._level || 0),
      receiptStreak: Number(summary?._receiptStreak || 0),
      checkInStreak: Number(summary?._checkInStreak || 0),
      totalCheckIns: Number(summary?._totalCheckIns || 0),
      receiptCount: Number(summary?._receiptCount || 0),
      hasBadge: !!summary?._hasBadge,
      lastCheckInDay: lastCheckInDay,
    };
  } catch (error: any) {
    console.error("❌ Critical failure in getUserSummary:", error.message || error);
    return {
      totalPoints: 0,
      level: 0,
      receiptStreak: 0,
      checkInStreak: 0,
      totalCheckIns: 0,
      receiptCount: 0,
      hasBadge: false,
      lastCheckInDay: 0,
    };
  }
}

// Helper: Calculate scores locally (mirrors contract logic)
function calculateScores(data: ReceiptSubmission): ContractResult {
  const neutralItems = data.totalItems - data.healthyItems - data.unhealthyItems;
  const rawScore = (data.healthyItems * 10) + (neutralItems * 5);
  const maxScore = data.totalItems * 10;
  const healthScore = Math.round((rawScore * 100) / maxScore);

  const expectedGrams = data.householdSize * data.daysCovered * 300;
  const ratio = (data.fruitVegGrams * 100) / expectedGrams;

  let nutritionScore = 75;
  if (ratio < 30) nutritionScore = 10;
  else if (ratio < 50) nutritionScore = 40;
  else if (ratio < 80) nutritionScore = 75;
  else if (ratio <= 120) nutritionScore = 100;
  else if (ratio <= 150) nutritionScore = 75;
  else nutritionScore = 40;

  let points = 50; // BASE_POINTS
  if (healthScore >= 60) points += healthScore - 50;
  const healthyRatio = (data.healthyItems * 100) / data.totalItems;
  if (healthyRatio >= 80) points += 20;
  else if (healthyRatio >= 50) points += 10;
  if (nutritionScore >= 80) points += 30;
  else if (nutritionScore >= 50) points += 15;
  else if (nutritionScore < 30) points = Math.max(10, points - 20);

  return {
    healthScore,
    nutritionScore,
    pointsEarned: points,
    daysCovered: data.daysCovered,
    txHash: "",
    badgeMinted: false,
  };
}

// Mock response for development
function mockContractResponse(data: ReceiptSubmission): ContractResult {
  const result = calculateScores(data);
  return {
    ...result,
    txHash: "0x0000000000000000000000000000000000000000000000000000000000000000",
    badgeMinted: false,
  };
}

export interface LeaderboardEntry {
  address: string;
  totalPoints: number;
  level: number;
  streak: number;
  hasBadge: boolean;
}

/**
 * Get leaderboard from contract events
 * Queries ReceiptSubmitted events to build the leaderboard
 */
export async function getLeaderboard(limit: number = 100): Promise<LeaderboardEntry[]> {
  const rpcUrl = process.env.RPC_URL || process.env.BASE_RPC_URL || process.env.BASE_SEPOLIA_RPC_URL;

  if (!rpcUrl) {
    console.log("⚠️ No RPC_URL available, returning mock leaderboard");
    return getMockLeaderboard(limit);
  }

  try {
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const contractAddr = process.env.CONTRACT_ADDRESS || CONTRACT_ADDRESS;
    const c = new Contract(contractAddr, REPLATE_QUEST_ABI, provider);

    console.log(`📡 Fetching live leaderboard from ${contractAddr}...`);

    // Get current block height to avoid "exceed maximum block range" error
    // Most free RPCs like Base Sepolia have a 50k block range limit.
    const latestBlock = await provider.getBlockNumber();
    const startBlock = Math.max(0, latestBlock - 48000);

    console.log(`🔎 Querying blocks ${startBlock} to latest...`);

    const [receiptEvents, badgeEvents] = await Promise.all([
      c.queryFilter(c.filters.ReceiptSubmitted(), startBlock, 'latest'),
      c.queryFilter(c.filters.BadgeMinted(), startBlock, 'latest')
    ]);

    console.log(`📊 Found ${receiptEvents.length} submissions and ${badgeEvents.length} badges`);

    const userStats = new Map<string, { points: number; hasBadge: boolean }>();

    // Process points
    for (const event of receiptEvents) {
      if (!('args' in event)) continue;
      const user = (event.args[0] as string).toLowerCase();
      const points = Number(event.args[3] || 0);

      const existing = userStats.get(user) || { points: 0, hasBadge: false };
      existing.points += points;
      userStats.set(user, existing);
    }

    // Process badges
    for (const event of badgeEvents) {
      if (!('args' in event)) continue;
      const user = (event.args[0] as string).toLowerCase();
      if (userStats.has(user)) {
        userStats.get(user)!.hasBadge = true;
      } else {
        userStats.set(user, { points: 0, hasBadge: true });
      }
    }

    const leaderboard: LeaderboardEntry[] = Array.from(userStats.entries())
      .map(([address, data]) => ({
        address,
        totalPoints: data.points,
        level: Math.floor(data.points / 500),
        streak: 0,
        hasBadge: data.hasBadge,
      }))
      .sort((a, b) => b.totalPoints - a.totalPoints)
      .slice(0, limit);

    return leaderboard;
  } catch (error: any) {
    console.error("❌ Failed to get leaderboard from blockchain:", error.message || error);
    return getMockLeaderboard(limit);
  }
}

/**
 * Get user's rank from contract
 */
export async function getUserRank(userAddress: string): Promise<LeaderboardEntry | null> {
  try {
    const c = getContract();
    const summary = await c.getUserSummary(userAddress);

    return {
      address: userAddress,
      totalPoints: Number(summary?._totalPoints || 0),
      level: Number(summary?._level || 0),
      streak: Number(summary?._receiptStreak || 0),
      hasBadge: !!summary?._hasBadge,
    };
  } catch (error) {
    console.warn("⚠️ Failed to get user rank:", error);
    return null;
  }
}

/**
 * Get current week report for a user
 */
export async function getUserWeekReport(userAddress: string) {
  try {
    const c = getContract();
    const report = await c.getCurrentWeekReport(userAddress);

    return {
      weekPoints: Number(report?.[0] || 0),
      receiptCount: Number(report?.[1] || 0),
      avgHealthScore: Number(report?.[2] || 0),
      avgNutritionScore: Number(report?.[3] || 0),
    };
  } catch (error) {
    console.warn("⚠️ Failed to get week report:", error);
    return {
      weekPoints: 0,
      receiptCount: 0,
      avgHealthScore: 0,
      avgNutritionScore: 0,
    };
  }
}

function getMockLeaderboard(limit: number): LeaderboardEntry[] {
  const mock: LeaderboardEntry[] = [
    { address: "0x1234567890abcdef1234567890abcdef12345678", totalPoints: 12500, level: 25, streak: 8, hasBadge: true },
    { address: "0x2345678901abcdef2345678901abcdef23456789", totalPoints: 10200, level: 20, streak: 5, hasBadge: true },
    { address: "0x3456789012abcdef3456789012abcdef34567890", totalPoints: 8500, level: 17, streak: 3, hasBadge: true },
    { address: "0x4567890123abcdef4567890123abcdef45678901", totalPoints: 7200, level: 14, streak: 2, hasBadge: false },
    { address: "0x5678901234abcdef5678901234abcdef56789012", totalPoints: 6500, level: 13, streak: 1, hasBadge: false },
  ];
  return mock.slice(0, limit);
}

export interface PoolStatus {
  weeklyPool: number;
  devFund: number;
  currentPhase: number;
}

/**
 * Get pool status from contract
 */
export async function getPoolStatus(): Promise<PoolStatus> {
  try {
    const c = getContract();
    const status = await c.getPoolStatus();

    return {
      weeklyPool: Number(status?.[0] || 0),
      devFund: Number(status?.[1] || 0),
      currentPhase: Number(status?.[2] || 0),
    };
  } catch (error) {
    console.warn("⚠️ Failed to get pool status:", error);
    return { weeklyPool: 0, devFund: 0, currentPhase: 0 };
  }
}

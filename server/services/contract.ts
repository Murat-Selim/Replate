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
        healthScore: decoded[0],
        nutritionScore: decoded[1],
        pointsEarned: Number(decoded[2]),
        daysCovered: data.daysCovered,
        txHash: tx.hash,
        badgeMinted,
      };
    }

    // Fallback calculation if event not found
    return calculateScores(data);
  } catch (error) {
    console.error("❌ Contract submission failed:", error);
    throw new Error("Failed to submit receipt to blockchain");
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
    const today = Math.floor(Date.now() / 1000 / 86400);
    const lastDay = await c.lastCheckInDay(userAddress);
    
    if (Number(lastDay) >= today) {
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
    // Extract reason from contract revert if possible
    const reason = error?.reason || error?.message || "Check-in failed";
    throw new Error(reason);
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
    const summary = await c.getUserSummary(userAddress);
    
    let lastCheckInDay = 0;
    try {
      lastCheckInDay = Number(await c.lastCheckInDay(userAddress));
    } catch (e) {
      console.warn("⚠️ Could not fetch lastCheckInDay from contract:", e);
    }

    return {
      totalPoints: Number(summary._totalPoints),
      level: Number(summary._level),
      receiptStreak: Number(summary._receiptStreak),
      checkInStreak: Number(summary._checkInStreak),
      totalCheckIns: Number(summary._totalCheckIns),
      receiptCount: Number(summary._receiptCount),
      hasBadge: summary._hasBadge,
      lastCheckInDay: lastCheckInDay,
    };
  } catch (error) {
    console.error("❌ Failed to get user summary:", error);
    // Return empty but valid object instead of throwing
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
  const rpcUrl = process.env.RPC_URL || process.env.BASE_SEPOLIA_RPC_URL;

  if (!rpcUrl) {
    return getMockLeaderboard(limit);
  }

  try {
    const provider = new ethers.JsonRpcProvider(rpcUrl);

    // Get all ReceiptSubmitted events
    const contract = new Contract(CONTRACT_ADDRESS, REPLATE_QUEST_ABI, provider);

    // Query events - get from block 0 to latest
    const filter = contract.filters.ReceiptSubmitted();
    const events = await contract.queryFilter(filter, 0, 'latest');

    // Aggregate points by user
    const userPoints = new Map<string, { points: bigint; hasBadge: boolean }>();

    for (const event of events) {
      if (!('args' in event)) continue;
      const eventArgs = event.args as unknown as [string, number, number, bigint, number, number] | undefined;
      const user = eventArgs?.[0];
      const points = eventArgs?.[3];

      if (user && points) {
        const existing = userPoints.get(user) || { points: BigInt(0), hasBadge: false };
        existing.points += points;
        userPoints.set(user, existing);
      }
    }

    // Get badge status for each user
    for (const [user] of userPoints) {
      try {
        const hasBadge = await contract.hasBadge(user);
        const existing = userPoints.get(user)!;
        existing.hasBadge = hasBadge;
      } catch {
        // Continue without badge info
      }
    }

    // Convert to array and sort
    const leaderboard: LeaderboardEntry[] = Array.from(userPoints.entries())
      .map(([address, data]) => ({
        address,
        totalPoints: Number(data.points),
        level: Math.floor(Number(data.points) / 500),
        streak: 0, // Would need to query streak separately
        hasBadge: data.hasBadge,
      }))
      .sort((a, b) => b.totalPoints - a.totalPoints)
      .slice(0, limit);

    return leaderboard;
  } catch (error) {
    console.error("❌ Failed to get leaderboard from contract:", error);
    return getMockLeaderboard(limit);
  }
}

/**
 * Get user's rank from contract
 */
export async function getUserRank(userAddress: string): Promise<LeaderboardEntry | null> {
  const rpcUrl = process.env.RPC_URL || process.env.BASE_SEPOLIA_RPC_URL;

  if (!rpcUrl) {
    return null;
  }

  try {
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const contract = new Contract(CONTRACT_ADDRESS, REPLATE_QUEST_ABI, provider);

    const summary = await contract.getUserSummary(userAddress);

    return {
      address: userAddress,
      totalPoints: Number(summary._totalPoints),
      level: Number(summary._level),
      streak: Number(summary._receiptStreak),
      hasBadge: summary._hasBadge,
    };
  } catch (error) {
    console.error("❌ Failed to get user rank:", error);
    return null;
  }
}

/**
 * Get current week report for a user
 */
export async function getUserWeekReport(userAddress: string) {
  const rpcUrl = process.env.RPC_URL || process.env.BASE_SEPOLIA_RPC_URL;

  if (!rpcUrl) {
    return {
      weekPoints: 0,
      receiptCount: 0,
      avgHealthScore: 0,
      avgNutritionScore: 0,
    };
  }

  try {
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const contract = new Contract(CONTRACT_ADDRESS, REPLATE_QUEST_ABI, provider);

    const report = await contract.getCurrentWeekReport(userAddress);

    return {
      weekPoints: Number(report.weekPoints),
      receiptCount: Number(report.receiptCount),
      avgHealthScore: Number(report.avgHealthScore),
      avgNutritionScore: Number(report.avgNutritionScore),
    };
  } catch (error) {
    console.error("❌ Failed to get week report:", error);
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
  const rpcUrl = process.env.RPC_URL || process.env.BASE_SEPOLIA_RPC_URL;

  if (!rpcUrl) {
    return { weeklyPool: 0, devFund: 0, currentPhase: 0 };
  }

  try {
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const contract = new Contract(CONTRACT_ADDRESS, REPLATE_QUEST_ABI, provider);

    const status = await contract.getPoolStatus();

    return {
      weeklyPool: Number(status._weeklyPool),
      devFund: Number(status._devFund),
      currentPhase: Number(status._currentPhase),
    };
  } catch (error) {
    console.error("❌ Failed to get pool status:", error);
    return { weeklyPool: 0, devFund: 0, currentPhase: 0 };
  }
}

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
}

function getContract(): Contract {
  if (!contract) {
    const rpcUrl = process.env.RPC_URL || process.env.BASE_SEPOLIA_RPC_URL;
    const privateKey = process.env.VALIDATOR_PRIVATE_KEY;

    if (!rpcUrl || !privateKey) {
      throw new Error("Missing RPC_URL or VALIDATOR_PRIVATE_KEY in environment");
    }

    provider = new ethers.JsonRpcProvider(rpcUrl);
    wallet = new Wallet(privateKey, provider);
    contract = new Contract(CONTRACT_ADDRESS, REPLATE_QUEST_ABI, wallet);
  }

  return contract;
}

/**
 * Submit a verified receipt to the smart contract
 */
export async function submitReceiptToContract(data: ReceiptSubmission): Promise<ContractResult> {
  // Check if contract is deployed
  if (CONTRACT_ADDRESS === "0x0000000000000000000000000000000000000000") {
    console.log("⚠️ Contract not deployed, using mock response");
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
    const event = receipt.logs.find((log: { topics: string[] }) => 
      log.topics[0] === ethers.id("ReceiptSubmitted(address,uint8,uint8,uint256,uint16,uint16)")
    );

    if (event) {
      const decoded = ethers.AbiCoder.defaultAbiCoder().decode(
        ["uint8", "uint8", "uint256", "uint16", "uint16"],
        event.data
      );

      return {
        healthScore: decoded[0],
        nutritionScore: decoded[1],
        pointsEarned: decoded[2],
        daysCovered: data.daysCovered,
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
  if (CONTRACT_ADDRESS === "0x0000000000000000000000000000000000000000") {
    return { success: true, pointsEarned: 10 };
  }

  try {
    const c = getContract();
    const tx = await c.checkIn(userAddress);
    await tx.wait();

    return { success: true, pointsEarned: 10 };
  } catch (error) {
    console.error("❌ Check-in failed:", error);
    throw error;
  }
}

/**
 * Finalize a user's weekly streak
 */
export async function finalizeUserWeek(userAddress: string): Promise<{ success: boolean; newStreak: number }> {
  if (CONTRACT_ADDRESS === "0x0000000000000000000000000000000000000000") {
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
  if (CONTRACT_ADDRESS === "0x0000000000000000000000000000000000000000") {
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
  if (CONTRACT_ADDRESS === "0x0000000000000000000000000000000000000000") {
    return {
      totalPoints: 0,
      level: 0,
      receiptStreak: 0,
      checkInStreak: 0,
      totalCheckIns: 0,
      receiptCount: 0,
      hasBadge: false,
    };
  }

  try {
    const c = getContract();
    const summary = await c.getUserSummary(userAddress);

    return {
      totalPoints: Number(summary._totalPoints),
      level: Number(summary._level),
      receiptStreak: Number(summary._receiptStreak),
      checkInStreak: Number(summary._checkInStreak),
      totalCheckIns: Number(summary._totalCheckIns),
      receiptCount: Number(summary._receiptCount),
      hasBadge: summary._hasBadge,
    };
  } catch (error) {
    console.error("❌ Failed to get user summary:", error);
    throw error;
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
  };
}

// Mock response for development
function mockContractResponse(data: ReceiptSubmission): ContractResult {
  return calculateScores(data);
}

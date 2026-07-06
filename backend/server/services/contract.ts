import { ethers, Wallet, Contract } from "ethers";
import { REPLATE_QUEST_ABI, CONTRACT_ADDRESS } from "../../src/lib/contract.js";

// ─── Sabitler ─────────────────────────────────────────────────────────
// FIX: Duplicate'di, modül seviyesine taşındı
const BUILDER_CODE_SUFFIX = "62635f37746f39316561760b0080218021802180218021802180218021";

// FIX: getRpcList her çağrıda array oluşturuyordu, bir kez hesapla
const RPC_LIST: string[] = [
  process.env.RPC_URL || process.env.BASE_RPC_URL,
  "https://mainnet.base.org",
  "https://base-rpc.publicnode.com",
  "https://base.meowrpc.com",
].filter(Boolean) as string[];

const CONTRACT_DEPLOY_BLOCK = 47849426;

// ─── Singleton state ──────────────────────────────────────────────────
let provider: ethers.JsonRpcProvider | null = null;
let wallet: Wallet | null = null;
let contract: Contract | null = null;
let currentRpcIndex = 0;

// ─── User discovery cache (1 saatlik TTL) ────────────────────────────
// FIX: discoverUsersFromLogs her leaderboard refresh'te Basescan'a istek
// atıyordu. Artık 1 saatlik cache ile korunuyor.
interface UsersCache {
  addresses: string[];
  timestamp: number;
}
let usersCache: UsersCache | null = null;
const USERS_CACHE_TTL = 60 * 60 * 1000; // 1 saat

export function clearUsersCache(): void {
  usersCache = null;
}

// ─── Interfaces ───────────────────────────────────────────────────────
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

export interface LeaderboardEntry {
  address: string;
  totalPoints: number;
  level: number;
  streak: number;
  hasBadge: boolean;
  totalCheckIns: number;
  receiptCount: number;
  weeklyPoints: number;
}

export interface PoolStatus {
  weeklyPool: number;
  devFund: number;
  currentPhase: number;
}

// ─── Provider yardımcıları ────────────────────────────────────────────
function buildProvider(rpcUrl: string): ethers.JsonRpcProvider {
  const connection = new ethers.FetchRequest(rpcUrl);
  connection.timeout = 15000;
  return new ethers.JsonRpcProvider(connection);
}

function getContract(): Contract {
  if (!contract) {
    const rpcUrl = RPC_LIST[currentRpcIndex] || RPC_LIST[0];
    const privateKey = process.env.VALIDATOR_PRIVATE_KEY || process.env.PRIVATE_KEY;

    if (!rpcUrl || !privateKey) {
      throw new Error("Missing RPC_URL or VALIDATOR_PRIVATE_KEY in environment");
    }

    provider = buildProvider(rpcUrl);
    wallet = new Wallet(privateKey, provider);
    contract = new Contract(
      process.env.CONTRACT_ADDRESS || CONTRACT_ADDRESS,
      REPLATE_QUEST_ABI,
      wallet
    );
  }
  return contract;
}

// FIX: rotateRpc artık wallet'ı da doğru şekilde günceller
function rotateRpc(): boolean {
  if (currentRpcIndex >= RPC_LIST.length - 1) return false;

  currentRpcIndex++;
  const nextRpc = RPC_LIST[currentRpcIndex];
  const privateKey = process.env.VALIDATOR_PRIVATE_KEY || process.env.PRIVATE_KEY;

  console.log(`🔄 RPC rotation: ${nextRpc}`);

  if (!privateKey) return false;

  provider = buildProvider(nextRpc);
  wallet = new Wallet(privateKey, provider);
  contract = new Contract(
    process.env.CONTRACT_ADDRESS || CONTRACT_ADDRESS,
    REPLATE_QUEST_ABI,
    wallet
  );
  return true;
}

// ─── Retry mekanizması ────────────────────────────────────────────────
async function withRetry<T>(fn: (c: Contract) => Promise<T>): Promise<T> {
  const maxAttempts = 4;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn(getContract());
    } catch (error: any) {
      const isRetryable =
        error?.message?.includes("rate limit") ||
        error?.message?.includes("exceeded maximum retry limit") ||
        error?.message?.includes("429") ||
        error?.message?.includes("500") ||
        error?.message?.includes("SERVER_ERROR") ||
        error?.message?.includes("network") ||
        error?.message?.includes("timeout");

      console.warn(
        `⚠️ Attempt ${attempt + 1}/${maxAttempts} failed:`,
        error.message || error
      );

      if (isRetryable && attempt < maxAttempts - 1) {
        const rotated = rotateRpc();
        if (rotated) continue;
      }

      throw error;
    }
  }

  throw new Error("Failed after multiple retries");
}

// ─── Receipt submission ───────────────────────────────────────────────
export async function submitReceiptToContract(
  data: ReceiptSubmission
): Promise<ContractResult> {
  const rpcUrl = process.env.RPC_URL || process.env.BASE_RPC_URL;
  const privateKey = process.env.VALIDATOR_PRIVATE_KEY || process.env.PRIVATE_KEY;

  if (!rpcUrl || !privateKey) {
    console.log("⚠️ Contract not configured, using mock response");
    return mockContractResponse(data);
  }

  try {
    return await withRetry(async (c) => {
      console.log("📊 Submitting to contract:", {
        user: data.user,
        totalItems: data.totalItems,
        healthyItems: data.healthyItems,
        fruitVegGrams: data.fruitVegGrams,
      });

      const txRequest = await c.submitReceipt.populateTransaction(
        data.user,
        data.totalItems,
        data.healthyItems,
        data.unhealthyItems,
        data.fruitVegGrams,
        data.householdSize,
        data.daysCovered
      );
      // FIX: BUILDER_CODE_SUFFIX artık modül sabiti
      txRequest.data = txRequest.data + BUILDER_CODE_SUFFIX;

      if (!wallet) throw new Error("Wallet not initialized");

      const tx = await wallet.sendTransaction(txRequest);
      console.log(`📤 Transaction sent: ${tx.hash}`);

      const receipt = await tx.wait();
      if (!receipt) throw new Error("Transaction failed: No receipt returned");

      console.log(`✅ Confirmed in block ${receipt.blockNumber}`);

      const receiptEvent = receipt.logs.find((log: any) =>
        log.topics[0] ===
        ethers.id("ReceiptSubmitted(address,uint8,uint8,uint256,uint16,uint16)")
      );

      const badgeMinted = !!receipt.logs.find((log: any) =>
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

      return calculateScores(data);
    });
  } catch (error: any) {
    console.error("❌ Contract submission failed:", error);

    let message = "Failed to submit receipt to blockchain";
    if (error?.revert?.args?.[0]) {
      message = error.revert.args[0];
    } else if (error?.reason) {
      message = error.reason;
    } else if (error?.message?.includes("Already submitted")) {
      message = "Already submitted a receipt today";
    } else if (error?.message) {
      message = error.message;
    }

    throw new Error(message);
  }
}

// ─── Check-in ─────────────────────────────────────────────────────────
export async function submitCheckIn(
  userAddress: string
): Promise<{ success: boolean; pointsEarned: number }> {
  const rpcUrl = process.env.RPC_URL || process.env.BASE_RPC_URL;
  const privateKey = process.env.VALIDATOR_PRIVATE_KEY || process.env.PRIVATE_KEY;

  if (!rpcUrl || !privateKey) {
    return { success: true, pointsEarned: 10 };
  }

  try {
    return await withRetry(async (c) => {
      let lastDay = 0;
      try {
        lastDay = Number(await c.lastCheckInDay(userAddress) || 0);
      } catch {
        console.warn("⚠️ Could not fetch lastCheckInDay, proceeding anyway");
      }

      const today = Math.floor(Date.now() / 1000 / 86400);
      if (lastDay >= today) throw new Error("Already checked in today");

      console.log(`🔗 Check-in for ${userAddress}...`);

      const txRequest = await c.checkIn.populateTransaction(userAddress);
      // FIX: BUILDER_CODE_SUFFIX artık modül sabiti
      txRequest.data = txRequest.data + BUILDER_CODE_SUFFIX;

      if (!wallet) throw new Error("Wallet not initialized");

      const tx = await wallet.sendTransaction(txRequest);
      console.log(`📤 Check-in tx: ${tx.hash}`);
      await tx.wait();
      console.log(`✅ Check-in confirmed for ${userAddress}`);

      return { success: true, pointsEarned: 10 };
    });
  } catch (error: any) {
    console.error("❌ Check-in failed:", error);
    let message = error?.message || "Check-in failed";
    if (message.includes("BAD_DATA") || message.includes("decode")) {
      message = "Blockchain connection issue. Please try again later.";
    }
    throw new Error(message);
  }
}

// ─── Week finalization ────────────────────────────────────────────────
// FIX: withRetry eklendi — daha önce retry yoktu
export async function finalizeUserWeek(
  userAddress: string
): Promise<{ success: boolean; newStreak: number }> {
  const rpcUrl = process.env.RPC_URL || process.env.BASE_RPC_URL;
  const privateKey = process.env.VALIDATOR_PRIVATE_KEY || process.env.PRIVATE_KEY;

  if (!rpcUrl || !privateKey) return { success: true, newStreak: 1 };

  try {
    return await withRetry(async (c) => {
      const tx = await c.finalizeWeek(userAddress);
      const receipt = await tx.wait();

      const event = receipt.logs.find((log: { topics: string[] }) =>
        log.topics[0] ===
        ethers.id("WeekFinalized(address,uint256,uint256,uint256)")
      );

      if (event) {
        const decoded = ethers.AbiCoder.defaultAbiCoder().decode(
          ["uint256", "uint256", "uint256"],
          event.data
        );
        return { success: true, newStreak: Number(decoded[2]) };
      }

      return { success: true, newStreak: 0 };
    });
  } catch (error) {
    console.error("❌ Week finalization failed:", error);
    throw error;
  }
}

// ─── Weekly reward distribution ───────────────────────────────────────
// FIX: withRetry eklendi — para dağıtan fonksiyon retry'sız kalmamalı
export async function distributeWeeklyRewards(
  topUsers: string[],
  shares: bigint[]
): Promise<{ success: boolean; totalDistributed: bigint }> {
  const rpcUrl = process.env.RPC_URL || process.env.BASE_RPC_URL;
  const privateKey = process.env.VALIDATOR_PRIVATE_KEY || process.env.PRIVATE_KEY;

  if (!rpcUrl || !privateKey) {
    return { success: true, totalDistributed: BigInt(0) };
  }

  try {
    return await withRetry(async (c) => {
      const tx = await c.distributeWeeklyRewards(topUsers, shares);
      await tx.wait();
      return { success: true, totalDistributed: BigInt(0) };
    });
  } catch (error) {
    console.error("❌ Reward distribution failed:", error);
    throw error;
  }
}

// ─── User summary ─────────────────────────────────────────────────────
export async function getUserSummary(userAddress: string) {
  const rpcUrl = process.env.RPC_URL || process.env.BASE_RPC_URL;
  const privateKey = process.env.VALIDATOR_PRIVATE_KEY || process.env.PRIVATE_KEY;

  const emptyResult = {
    totalPoints: 0,
    level: 0,
    receiptStreak: 0,
    checkInStreak: 0,
    totalCheckIns: 0,
    receiptCount: 0,
    hasBadge: false,
    lastCheckInDay: 0,
  };

  if (!rpcUrl || !privateKey) return emptyResult;

  try {
    return await withRetry(async (c) => {
      console.log(`📡 getUserSummary: ${c.target} → ${userAddress}`);

      // FIX: Hata yutmak yerine withRetry içinde doğal fırlatılıyor
      const [summary, lastCheckInDay] = await Promise.all([
        c.getUserSummary(userAddress),
        c.lastCheckInDay(userAddress).catch(() => 0),
      ]);

      return {
        totalPoints: Number(summary?._totalPoints || 0),
        level: Number(summary?._level || 0),
        receiptStreak: Number(summary?._receiptStreak || 0),
        checkInStreak: Number(summary?._checkInStreak || 0),
        totalCheckIns: Number(summary?._totalCheckIns || 0),
        receiptCount: Number(summary?._receiptCount || 0),
        hasBadge: !!summary?._hasBadge,
        lastCheckInDay: Number(lastCheckInDay || 0),
      };
    });
  } catch (error: any) {
    console.error("❌ getUserSummary failed:", error.message || error);
    return emptyResult;
  }
}

// ─── User discovery (Basescan API + RPC fallback) ─────────────────────
async function discoverUsersFromLogs(): Promise<string[]> {
  // 1 saatlik cache — her leaderboard refresh'te API'ye gitmesin
  if (usersCache && Date.now() - usersCache.timestamp < USERS_CACHE_TTL) {
    console.log(`📋 User cache hit: ${usersCache.addresses.length} users`);
    return usersCache.addresses;
  }

  const contractAddr = (process.env.CONTRACT_ADDRESS || CONTRACT_ADDRESS).toLowerCase();
  const basescanKey = process.env.BASESCAN_API_KEY;

  const receiptTopic = ethers.id(
    "ReceiptSubmitted(address,uint8,uint8,uint256,uint16,uint16)"
  );
  const checkInTopic = ethers.id("CheckedIn(address,uint256,uint256,uint256)");

  const users = new Set<string>();

  // ── Primary: Basescan API ────────────────────────────────────────────
  // Handles full block history in paginated 1000-log pages — no block range limits.
  if (basescanKey) {
    try {
      console.log(`📡 Discovering users from Basescan API (from block ${CONTRACT_DEPLOY_BLOCK})...`);

      for (const topic0 of [receiptTopic, checkInTopic]) {
        let page = 1;
        while (true) {
          const url =
            `https://api.basescan.org/api` +
            `?module=logs&action=getLogs` +
            `&address=${contractAddr}` +
            `&topic0=${topic0}` +
            `&fromBlock=${CONTRACT_DEPLOY_BLOCK}` +
            `&toBlock=latest` +
            `&page=${page}` +
            `&offset=1000` +
            `&apikey=${basescanKey}`;

          const resp = await fetch(url);
          const json = await resp.json() as { status: string; result: any[] };

          if (json.status !== "1" || !Array.isArray(json.result) || json.result.length === 0) break;

          for (const log of json.result) {
            if (log.topics?.[1]) {
              const addr = ethers.getAddress("0x" + log.topics[1].slice(26));
              users.add(addr.toLowerCase());
            }
          }

          if (json.result.length < 1000) break; // son sayfa
          page++;
        }
      }

      console.log(`✅ Basescan discovered ${users.size} unique users`);
    } catch (error: any) {
      console.error("⚠️ Basescan user discovery failed:", error.message || error);
    }
  }

  // ── Fallback: Alchemy / Public RPC (chunked) ─────────────────────────
  // Kullanılır sadece Basescan başarısız olursa veya key yoksa.
  if (users.size === 0) {
    const rpcUrl = process.env.RPC_URL || process.env.BASE_RPC_URL;
    if (rpcUrl) {
      try {
        console.log(`📡 Falling back to RPC chunked log scan...`);
        const readProvider = buildProvider(rpcUrl);
        const latestBlock = await readProvider.getBlockNumber();
        const CHUNK = 10_000; // Alchemy'de daha büyük chunk çalışıyor

        for (const topic0 of [receiptTopic, checkInTopic]) {
          for (let start = CONTRACT_DEPLOY_BLOCK; start <= latestBlock; start += CHUNK) {
            const end = Math.min(start + CHUNK - 1, latestBlock);
            try {
              const logs = await readProvider.getLogs({
                address: contractAddr,
                topics: [topic0],
                fromBlock: start,
                toBlock: end,
              });
              for (const log of logs) {
                if (log.topics[1]) {
                  const addr = ethers.getAddress("0x" + log.topics[1].slice(26));
                  users.add(addr.toLowerCase());
                }
              }
            } catch {
              // Hatalı chunk'ı geç, devam et
            }
          }
        }
        console.log(`✅ RPC fallback discovered ${users.size} unique users`);
      } catch (fallbackError: any) {
        console.error("❌ RPC fallback user discovery failed:", fallbackError.message || fallbackError);
      }
    }
  }

  const addresses = Array.from(users);
  console.log(`✅ Total unique users discovered: ${addresses.length}`);

  // Cache'e yaz
  usersCache = { addresses, timestamp: Date.now() };

  return addresses;
}

// ─── Leaderboard ──────────────────────────────────────────────────────
export async function getLeaderboard(
  limit: number = 100
): Promise<LeaderboardEntry[]> {
  const rpcUrl = process.env.RPC_URL || process.env.BASE_RPC_URL;

  if (!rpcUrl) {
    console.log("⚠️ No RPC_URL, returning mock leaderboard");
    return getMockLeaderboard(limit);
  }

  try {
    const readProvider = buildProvider(rpcUrl);
    const contractAddr = process.env.CONTRACT_ADDRESS || CONTRACT_ADDRESS;
    const c = new Contract(contractAddr, REPLATE_QUEST_ABI, readProvider);

    const addresses = await discoverUsersFromLogs();
    console.log(`📡 Fetching leaderboard for ${addresses.length} users...`);

    if (addresses.length === 0) return [];

    const BATCH = 10;
    const entries: LeaderboardEntry[] = [];

    for (let i = 0; i < addresses.length; i += BATCH) {
      const batch = addresses.slice(i, i + BATCH);
      const results = await Promise.allSettled(
        batch.map(async (addr) => {
          const [summary, weekReport] = await Promise.all([
            c.getUserSummary(addr),
            c.getCurrentWeekReport(addr),
          ]);

          const totalPoints = Number(
            summary?._totalPoints || summary?.[0] || 0
          );
          if (totalPoints === 0) return null;

          return {
            address: addr,
            totalPoints,
            level: Number(summary?._level || summary?.[1] || 0),
            streak: Number(
              summary?._receiptStreak ||
              summary?.[2] ||
              summary?._checkInStreak ||
              summary?.[3] ||
              0
            ),
            hasBadge: !!(summary?._hasBadge ?? summary?.[6] ?? false),
            totalCheckIns: Number(summary?._totalCheckIns || summary?.[4] || 0),
            receiptCount: Number(summary?._receiptCount || summary?.[5] || 0),
            weeklyPoints: Number(
              weekReport?.weekPoints ?? weekReport?.[0] ?? 0
            ),
          } as LeaderboardEntry;
        })
      );

      for (const r of results) {
        if (r.status === "fulfilled" && r.value !== null) {
          entries.push(r.value);
        }
      }
    }

    console.log(`✅ Leaderboard: ${entries.length} active users`);

    return entries
      .sort((a, b) => b.totalPoints - a.totalPoints)
      .slice(0, limit);
  } catch (error: any) {
    console.error("❌ Leaderboard fetch failed:", error.message || error);
    throw error;
  }
}

// ─── User rank ────────────────────────────────────────────────────────
export async function getUserRank(
  userAddress: string
): Promise<LeaderboardEntry | null> {
  try {
    const c = getContract();
    const summary = await c.getUserSummary(userAddress);

    return {
      address: userAddress,
      totalPoints: Number(summary?._totalPoints || 0),
      level: Number(summary?._level || 0),
      streak: Number(summary?._receiptStreak || 0),
      hasBadge: !!summary?._hasBadge,
      totalCheckIns: Number(summary?._totalCheckIns || 0),
      receiptCount: Number(summary?._receiptCount || 0),
      weeklyPoints: 0,
    };
  } catch (error) {
    console.warn("⚠️ Failed to get user rank:", error);
    return null;
  }
}

// ─── Week report ──────────────────────────────────────────────────────
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
    return { weekPoints: 0, receiptCount: 0, avgHealthScore: 0, avgNutritionScore: 0 };
  }
}

// ─── Pool status ──────────────────────────────────────────────────────
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

// ─── Hesap yardımcıları ───────────────────────────────────────────────
export function calculateScores(data: ReceiptSubmission): ContractResult {
  const neutralItems = data.totalItems - data.healthyItems - data.unhealthyItems;
  const rawScore = data.healthyItems * 10 + neutralItems * 5;
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

  let points = 50;
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

function mockContractResponse(data: ReceiptSubmission): ContractResult {
  return {
    ...calculateScores(data),
    txHash: "0x0000000000000000000000000000000000000000000000000000000000000000",
    badgeMinted: false,
  };
}

function getMockLeaderboard(limit: number): LeaderboardEntry[] {
  return [
    { address: "0x1234567890abcdef1234567890abcdef12345678", totalPoints: 12500, level: 25, streak: 8, hasBadge: true, totalCheckIns: 30, receiptCount: 15, weeklyPoints: 1200 },
    { address: "0x2345678901abcdef2345678901abcdef23456789", totalPoints: 10200, level: 20, streak: 5, hasBadge: true, totalCheckIns: 20, receiptCount: 10, weeklyPoints: 950 },
    { address: "0x3456789012abcdef3456789012abcdef34567890", totalPoints: 8500, level: 17, streak: 3, hasBadge: true, totalCheckIns: 15, receiptCount: 8, weeklyPoints: 600 },
    { address: "0x4567890123abcdef4567890123abcdef45678901", totalPoints: 7200, level: 14, streak: 2, hasBadge: false, totalCheckIns: 10, receiptCount: 5, weeklyPoints: 400 },
    { address: "0x5678901234abcdef5678901234abcdef56789012", totalPoints: 6500, level: 13, streak: 1, hasBadge: false, totalCheckIns: 5, receiptCount: 3, weeklyPoints: 200 },
  ].slice(0, limit);
}

// ─── Meta-Transaction (EIP-712) Functions ─────────────────────────────

/**
 * Get the current EIP-712 nonce for a user from the contract
 */
export async function getUserNonce(userAddress: string): Promise<number> {
  try {
    const c = getContract();
    const nonce = await c.nonces(userAddress);
    return Number(nonce);
  } catch (error: any) {
    console.error("❌ getUserNonce failed:", error.message || error);
    return 0;
  }
}

/**
 * Submit a check-in with EIP-712 signature (meta-transaction)
 * The user signs off-chain, backend relays the tx
 */
export async function submitCheckInWithSig(
  userAddress: string,
  deadline: number,
  signature: string
): Promise<{ success: boolean; pointsEarned: number; txHash: string }> {
  try {
    return await withRetry(async (c) => {
      console.log(`🔗 CheckInWithSig for ${userAddress}...`);

      const txRequest = await c.checkInWithSig.populateTransaction(
        userAddress,
        deadline,
        signature
      );
      // Append Builder Code suffix
      txRequest.data = txRequest.data + BUILDER_CODE_SUFFIX;

      if (!wallet) throw new Error("Wallet not initialized");

      const tx = await wallet.sendTransaction(txRequest);
      console.log(`📤 CheckInWithSig tx: ${tx.hash}`);
      await tx.wait();
      console.log(`✅ CheckInWithSig confirmed for ${userAddress}`);

      return { success: true, pointsEarned: 10, txHash: tx.hash };
    });
  } catch (error: any) {
    console.error("❌ CheckInWithSig failed:", error);
    let message = error?.message || "Check-in with signature failed";
    if (message.includes("Invalid signature")) {
      message = "Invalid signature. Please sign the message again.";
    } else if (message.includes("Signature expired")) {
      message = "Signature expired. Please sign again.";
    } else if (message.includes("Already checked in today")) {
      message = "Already checked in today";
    }
    throw new Error(message);
  }
}

/**
 * Submit a receipt with EIP-712 signature (meta-transaction)
 */
export async function submitReceiptWithSig(
  data: ReceiptSubmission,
  deadline: number,
  signature: string
): Promise<ContractResult> {
  try {
    return await withRetry(async (c) => {
      console.log("📊 SubmitReceiptWithSig:", {
        user: data.user,
        totalItems: data.totalItems,
        healthyItems: data.healthyItems,
      });

      const txRequest = await c.submitReceiptWithSig.populateTransaction(
        data.user,
        data.totalItems,
        data.healthyItems,
        data.unhealthyItems,
        data.fruitVegGrams,
        data.householdSize,
        data.daysCovered,
        deadline,
        signature
      );
      // Append Builder Code suffix
      txRequest.data = txRequest.data + BUILDER_CODE_SUFFIX;

      if (!wallet) throw new Error("Wallet not initialized");

      const tx = await wallet.sendTransaction(txRequest);
      console.log(`📤 ReceiptWithSig tx: ${tx.hash}`);

      const receipt = await tx.wait();
      if (!receipt) throw new Error("Transaction failed: No receipt returned");

      console.log(`✅ ReceiptWithSig confirmed in block ${receipt.blockNumber}`);

      const receiptEvent = receipt.logs.find((log: any) =>
        log.topics[0] ===
        ethers.id("ReceiptSubmitted(address,uint8,uint8,uint256,uint16,uint16)")
      );

      const badgeMinted = !!receipt.logs.find((log: any) =>
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

      return calculateScores(data);
    });
  } catch (error: any) {
    console.error("❌ ReceiptWithSig failed:", error);

    let message = "Failed to submit receipt with signature";
    if (error?.revert?.args?.[0]) {
      message = error.revert.args[0];
    } else if (error?.reason) {
      message = error.reason;
    } else if (error?.message) {
      message = error.message;
    }

    throw new Error(message);
  }
}
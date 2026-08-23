import { ethers } from "ethers";
import { REPLATE_QUEST_ABI } from "../../src/lib/contract.js";
import { runtimeConfig } from "../config.js";

const TX_HASH = /^0x[a-fA-F0-9]{64}$/;
const RECEIPT_HASH = TX_HASH;

export class VerifiedReceiptError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string,
  ) {
    super(message);
  }
}

export interface VerifiedReceipt {
  userAddress: string;
  receiptHash: string;
  totalItems: number;
  healthyItems: number;
  unhealthyItems: number;
  fruitVegGrams: number;
  householdSize: number;
  daysCovered: number;
  healthScore: number;
  nutritionScore: number;
  pointsEarned: number;
  blockNumber: number;
  builderCodeAttributed: boolean;
}

function toSafeNumber(value: bigint, field: string): number {
  const number = Number(value);
  if (!Number.isSafeInteger(number)) {
    throw new VerifiedReceiptError(`On-chain ${field} is out of range`, 422, "ONCHAIN_VALUE_OUT_OF_RANGE");
  }
  return number;
}

function sameAddress(left: string, right: string): boolean {
  return left.toLowerCase() === right.toLowerCase();
}

export async function verifyReceiptTransaction(txHash: string): Promise<VerifiedReceipt> {
  if (!TX_HASH.test(txHash)) {
    throw new VerifiedReceiptError("Valid transaction hash is required", 400, "INVALID_TX_HASH");
  }

  const rpcUrl = runtimeConfig.rpcUrl || "https://base-rpc.publicnode.com";
  const request = new ethers.FetchRequest(rpcUrl);
  request.timeout = 15_000;
  const provider = new ethers.JsonRpcProvider(request, runtimeConfig.chainId, { staticNetwork: true });
  const receipt = await provider.getTransactionReceipt(txHash);
  if (!receipt) {
    throw new VerifiedReceiptError("Transaction is not confirmed yet", 409, "TX_NOT_CONFIRMED");
  }
  if (receipt.status !== 1) {
    throw new VerifiedReceiptError("Reverted transactions are not accepted", 422, "TX_REVERTED");
  }

  const iface = new ethers.Interface(REPLATE_QUEST_ABI);
  const transaction = await provider.getTransaction(txHash);
  let directArgs: ethers.Result | null = null;
  if (transaction?.to && sameAddress(transaction.to, runtimeConfig.contractAddress)) {
    try {
      const parsed = iface.parseTransaction({ data: transaction.data, value: transaction.value });
      if (parsed?.name === "submitReceiptWithSig") directArgs = parsed.args;
    } catch {
      // Base Account may wrap the contract call in a batch transaction.
    }
  }

  let consumedUser = "";
  let consumedHash = "";
  let submittedUser = "";
  let healthScore = 0;
  let nutritionScore = 0;
  let pointsEarned = 0;
  let submittedFruitVegGrams = -1;

  for (const log of receipt.logs) {
    if (!sameAddress(log.address, runtimeConfig.contractAddress)) continue;
    let parsedLog: ethers.LogDescription | null;
    try {
      parsedLog = iface.parseLog({ topics: [...log.topics], data: log.data });
    } catch {
      continue;
    }
    if (!parsedLog) continue;
    if (parsedLog.name === "ReceiptHashConsumed") {
      consumedUser = String(parsedLog.args[0]);
      consumedHash = String(parsedLog.args[1]);
    }
    if (parsedLog.name === "ReceiptSubmitted") {
      submittedUser = String(parsedLog.args[0]);
      healthScore = toSafeNumber(BigInt(parsedLog.args[1]), "healthScore");
      nutritionScore = toSafeNumber(BigInt(parsedLog.args[2]), "nutritionScore");
      pointsEarned = toSafeNumber(BigInt(parsedLog.args[3]), "pointsEarned");
      submittedFruitVegGrams = toSafeNumber(BigInt(parsedLog.args[5]), "actualGrams");
    }
  }

  if (!consumedUser || !submittedUser || !sameAddress(consumedUser, submittedUser)) {
    throw new VerifiedReceiptError("Receipt events do not match the submitted user", 422, "EVENT_USER_MISMATCH");
  }

  const userAddress = submittedUser;
  const receiptHash = consumedHash;
  if (!ethers.isAddress(userAddress) || !RECEIPT_HASH.test(receiptHash)) {
    throw new VerifiedReceiptError("Receipt events contain invalid arguments", 422, "INVALID_RECEIPT_ARGS");
  }

  let totalItems: number;
  let healthyItems: number;
  let unhealthyItems: number;
  let fruitVegGrams: number;
  let householdSize: number;
  let daysCovered: number;

  if (directArgs) {
    if (String(directArgs[0]).toLowerCase() !== userAddress.toLowerCase() || String(directArgs[1]).toLowerCase() !== receiptHash.toLowerCase()) {
      throw new VerifiedReceiptError("Receipt transaction arguments are invalid", 422, "INVALID_RECEIPT_ARGS");
    }
    totalItems = toSafeNumber(BigInt(directArgs[2]), "totalItems");
    healthyItems = toSafeNumber(BigInt(directArgs[3]), "healthyItems");
    unhealthyItems = toSafeNumber(BigInt(directArgs[4]), "unhealthyItems");
    fruitVegGrams = toSafeNumber(BigInt(directArgs[5]), "fruitVegGrams");
    householdSize = toSafeNumber(BigInt(directArgs[6]), "householdSize");
    daysCovered = toSafeNumber(BigInt(directArgs[7]), "daysCovered");
  } else {
    const contract = new ethers.Contract(runtimeConfig.contractAddress, REPLATE_QUEST_ABI, provider);
    const summary = await contract.getUserSummary(userAddress);
    const receiptCount = toSafeNumber(BigInt(summary[5]), "receiptCount");
    if (receiptCount < 1) {
      throw new VerifiedReceiptError("Receipt was not found in the Replate contract", 422, "RECEIPT_NOT_FOUND");
    }
    const stored = await contract.receipts(userAddress, BigInt(receiptCount - 1));
    totalItems = toSafeNumber(BigInt(stored[3]), "totalItems");
    healthyItems = toSafeNumber(BigInt(stored[4]), "healthyItems");
    unhealthyItems = toSafeNumber(BigInt(stored[5]), "unhealthyItems");
    fruitVegGrams = toSafeNumber(BigInt(stored[6]), "fruitVegGrams");
    householdSize = toSafeNumber(BigInt(stored[7]), "householdSize");
    daysCovered = toSafeNumber(BigInt(stored[8]), "daysCovered");
  }

  if (submittedFruitVegGrams !== fruitVegGrams || healthyItems + unhealthyItems > totalItems ||
    healthScore === 0 && nutritionScore === 0 && pointsEarned === 0) {
    throw new VerifiedReceiptError("Receipt aggregate does not match on-chain data", 422, "ONCHAIN_AGGREGATE_MISMATCH");
  }

  return {
    userAddress,
    receiptHash,
    totalItems,
    healthyItems,
    unhealthyItems,
    fruitVegGrams,
    householdSize,
    daysCovered,
    healthScore,
    nutritionScore,
    pointsEarned,
    blockNumber: receipt.blockNumber,
    builderCodeAttributed: transaction?.data.toLowerCase().includes(runtimeConfig.builderCodeSuffix.toLowerCase()) ?? false,
  };
}

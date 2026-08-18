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

  const transaction = await provider.getTransaction(txHash);
  if (!transaction || !transaction.to || !sameAddress(transaction.to, runtimeConfig.contractAddress)) {
    throw new VerifiedReceiptError("Transaction was not sent to the Replate contract", 422, "INVALID_CONTRACT_TX");
  }

  const iface = new ethers.Interface(REPLATE_QUEST_ABI);
  const parsed = iface.parseTransaction({ data: transaction.data, value: transaction.value });
  if (!parsed || parsed.name !== "submitReceiptWithSig") {
    throw new VerifiedReceiptError("Transaction does not contain a signed receipt submission", 422, "INVALID_RECEIPT_CALL");
  }

  const args = parsed.args;
  const userAddress = String(args[0]);
  const receiptHash = String(args[1]);
  if (!ethers.isAddress(userAddress) || !RECEIPT_HASH.test(receiptHash)) {
    throw new VerifiedReceiptError("Receipt transaction arguments are invalid", 422, "INVALID_RECEIPT_ARGS");
  }

  const totalItems = toSafeNumber(BigInt(args[2]), "totalItems");
  const healthyItems = toSafeNumber(BigInt(args[3]), "healthyItems");
  const unhealthyItems = toSafeNumber(BigInt(args[4]), "unhealthyItems");
  const fruitVegGrams = toSafeNumber(BigInt(args[5]), "fruitVegGrams");
  const householdSize = toSafeNumber(BigInt(args[6]), "householdSize");
  const daysCovered = toSafeNumber(BigInt(args[7]), "daysCovered");

  let consumedUser = "";
  let consumedHash = "";
  let submittedUser = "";
  let healthScore = 0;
  let nutritionScore = 0;
  let pointsEarned = 0;
  let submittedFruitVegGrams = -1;

  for (const log of receipt.logs) {
    if (!sameAddress(log.address, runtimeConfig.contractAddress)) continue;
    const parsedLog = iface.parseLog({ topics: [...log.topics], data: log.data });
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

  if (!consumedUser || !submittedUser || !sameAddress(consumedUser, userAddress) || !sameAddress(submittedUser, userAddress)) {
    throw new VerifiedReceiptError("Receipt events do not match the submitted user", 422, "EVENT_USER_MISMATCH");
  }
  if (consumedHash.toLowerCase() !== receiptHash.toLowerCase()) {
    throw new VerifiedReceiptError("Receipt hash does not match the consumed hash event", 422, "EVENT_HASH_MISMATCH");
  }
  if (submittedFruitVegGrams !== fruitVegGrams || healthyItems + unhealthyItems > totalItems) {
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
    builderCodeAttributed: transaction.data.toLowerCase().endsWith(runtimeConfig.builderCodeSuffix.toLowerCase()),
  };
}

import { Contract, ethers } from "ethers";
import { CONTRACT_ADDRESS } from "../../src/lib/contract.js";

const READ_RPC = process.env.RPC_URL || process.env.BASE_RPC_URL || "https://mainnet.base.org";
const RECEIPT_HASH_ABI = ["function usedReceiptHashes(bytes32) view returns (bool)"];

export async function isReceiptHashUsed(receiptHash: string): Promise<boolean> {
  const provider = new ethers.JsonRpcProvider(READ_RPC);
  const contract = new Contract(
    process.env.CONTRACT_ADDRESS || CONTRACT_ADDRESS,
    RECEIPT_HASH_ABI,
    provider
  );
  return Boolean(await contract.usedReceiptHashes(receiptHash));
}

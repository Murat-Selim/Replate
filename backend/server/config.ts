import * as dotenv from "dotenv";
import { ethers } from "ethers";
import { BASE_MAINNET_CHAIN_ID, CONTRACT_ADDRESS } from "../src/lib/network.js";

dotenv.config();
const isProduction = process.env.NODE_ENV === "production";

export const runtimeConfig = {
  isProduction,
  contractAddress: CONTRACT_ADDRESS,
  chainId: Number(process.env.CHAIN_ID || BASE_MAINNET_CHAIN_ID),
  rpcUrl: (process.env.RPC_URL || process.env.BASE_RPC_URL || "").trim(),
  validatorPrivateKey: (process.env.VALIDATOR_PRIVATE_KEY || process.env.PRIVATE_KEY || "").trim(),
  cronSecret: (process.env.CRON_SECRET || "").trim(),
  allowMockContract: !isProduction && process.env.USE_MOCK_CONTRACT === "true",
};

export function validateRuntimeConfig(): void {
  const errors: string[] = [];
  if (!ethers.isAddress(runtimeConfig.contractAddress)) errors.push("CONTRACT_ADDRESS must be a valid EVM address");
  if (runtimeConfig.chainId !== BASE_MAINNET_CHAIN_ID) errors.push(`CHAIN_ID must be ${BASE_MAINNET_CHAIN_ID} for the Base mainnet deployment`);
  if (runtimeConfig.rpcUrl) {
    try {
      const url = new URL(runtimeConfig.rpcUrl);
      if (!["http:", "https:"].includes(url.protocol)) throw new Error();
    } catch { errors.push("RPC_URL/BASE_RPC_URL must be an HTTP(S) URL"); }
  }
  if (runtimeConfig.validatorPrivateKey && !/^0x[a-fA-F0-9]{64}$/.test(runtimeConfig.validatorPrivateKey)) errors.push("VALIDATOR_PRIVATE_KEY must be a 32-byte hex private key");
  if (isProduction) {
    if (!runtimeConfig.rpcUrl) errors.push("RPC_URL or BASE_RPC_URL is required");
    if (!runtimeConfig.validatorPrivateKey) errors.push("VALIDATOR_PRIVATE_KEY is required");
    if (!process.env.GOOGLE_APPLICATION_CREDENTIALS && !process.env.GOOGLE_CREDENTIALS_JSON) errors.push("Google Vision credentials are required");
    if (!(process.env.FRONTEND_URL || "").trim()) errors.push("FRONTEND_URL is required");
  }
  if (errors.length > 0) throw new Error(`Invalid runtime configuration: ${errors.join("; ")}`);
}

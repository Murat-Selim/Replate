import * as dotenv from "dotenv";
import { ethers } from "ethers";
import { BASE_MAINNET_CHAIN_ID, BASE_USDC_ADDRESS, CONTRACT_ADDRESS } from "../src/lib/network.js";

dotenv.config();
const isProduction = process.env.NODE_ENV === "production";

export const runtimeConfig = {
  isProduction,
  contractAddress: CONTRACT_ADDRESS,
  chainId: Number(process.env.CHAIN_ID || BASE_MAINNET_CHAIN_ID),
  rpcUrl: (process.env.RPC_URL || process.env.BASE_RPC_URL || "").trim(),
  databaseUrl: (process.env.DATABASE_URL || "").trim(),
  databaseSsl: (process.env.DATABASE_SSL || "").trim().toLowerCase() === "require",
  x402PayTo: (process.env.X402_PAY_TO || "").trim(),
  x402FacilitatorUrl: (process.env.X402_FACILITATOR_URL || "").trim(),
  x402FacilitatorApiKey: (process.env.X402_FACILITATOR_API_KEY || "").trim(),
  cdpApiKeyId: (process.env.CDP_API_KEY_ID || "").trim(),
  cdpApiKeySecret: (process.env.CDP_API_KEY_SECRET || "").trim(),
  x402Network: `eip155:${BASE_MAINNET_CHAIN_ID}` as `eip155:${number}`,
  x402Asset: BASE_USDC_ADDRESS,
  x402PriceAtomic: "10000",
  builderCode: (process.env.BUILDER_CODE || "bc_7to91eav").trim(),
  builderCodeSuffix: (process.env.BUILDER_CODE_SUFFIX || "62635f37746f39316561760b0080218021802180218021802180218021").trim().replace(/^0x/, ""),
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
  if (runtimeConfig.x402PayTo && !ethers.isAddress(runtimeConfig.x402PayTo)) errors.push("X402_PAY_TO must be a valid EVM address");
  if (runtimeConfig.x402FacilitatorUrl) {
    try {
      const url = new URL(runtimeConfig.x402FacilitatorUrl);
      if (!["http:", "https:"].includes(url.protocol)) throw new Error();
    } catch { errors.push("X402_FACILITATOR_URL must be an HTTP(S) URL"); }
  }
  if (runtimeConfig.x402FacilitatorUrl && !runtimeConfig.x402PayTo) {
    errors.push("X402_PAY_TO is required when X402_FACILITATOR_URL is configured");
  }
  if (runtimeConfig.x402FacilitatorApiKey && !runtimeConfig.x402FacilitatorUrl) {
    errors.push("X402_FACILITATOR_API_KEY requires X402_FACILITATOR_URL");
  }
  if (Boolean(runtimeConfig.cdpApiKeyId) !== Boolean(runtimeConfig.cdpApiKeySecret)) {
    errors.push("CDP_API_KEY_ID and CDP_API_KEY_SECRET must be configured together");
  }
  if (runtimeConfig.cdpApiKeyId && runtimeConfig.x402FacilitatorApiKey) {
    errors.push("Use either CDP credentials or generic X402_FACILITATOR_API_KEY, not both");
  }
  if (isProduction) {
    if (!runtimeConfig.rpcUrl) errors.push("RPC_URL or BASE_RPC_URL is required");
    if (!runtimeConfig.validatorPrivateKey) errors.push("VALIDATOR_PRIVATE_KEY is required");
    if (!process.env.GOOGLE_APPLICATION_CREDENTIALS && !process.env.GOOGLE_CREDENTIALS_JSON) errors.push("Google Vision credentials are required");
    if (!(process.env.FRONTEND_URL || "").trim()) errors.push("FRONTEND_URL is required");
  }
  if (errors.length > 0) throw new Error(`Invalid runtime configuration: ${errors.join("; ")}`);
}

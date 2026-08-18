import deployment from "../../../deployment.json" with { type: "json" };

/** Canonical ReplateQuest V3 proxy on Base mainnet (chain id 8453). */
export const BASE_MAINNET_CHAIN_ID = deployment.chainId;
export const BASE_MAINNET_CONTRACT_ADDRESS = deployment.contractAddress as `0x${string}`;
export const BASE_USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as const;
export const DEPLOYMENT_ABI_VERSION = deployment.abiVersion;

export const CONTRACT_ADDRESS =
  (process.env.CONTRACT_ADDRESS?.trim() || BASE_MAINNET_CONTRACT_ADDRESS) as `0x${string}`;

/** Canonical ReplateQuest V3 proxy on Base mainnet (chain id 8453). */
export const BASE_MAINNET_CHAIN_ID = 8453;
export const BASE_MAINNET_CONTRACT_ADDRESS = "0x9d646D474ba0D1bF03E61453898c160b7f9e3E90" as const;

export const CONTRACT_ADDRESS =
  (process.env.CONTRACT_ADDRESS?.trim() || BASE_MAINNET_CONTRACT_ADDRESS) as `0x${string}`;

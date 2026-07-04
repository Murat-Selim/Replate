'use client';

/**
 * CDP (Coinbase Developer Platform) Paymaster configuration.
 * Smart Wallets use this to sponsor gas fees via ERC-4337.
 *
 * Get your key from: https://portal.cdp.coinbase.com
 * Navigate to: Paymaster → Base Mainnet
 *
 * Set NEXT_PUBLIC_CDP_PAYMASTER_URL in your .env.local
 */

const CDP_PAYMASTER_URL =
  process.env.NEXT_PUBLIC_CDP_PAYMASTER_URL ||
  'https://api.developer.coinbase.com/rpc/v1/base/YOUR_CDP_KEY';

export const PAYMASTER_CAPABILITIES = {
  paymasterService: {
    url: CDP_PAYMASTER_URL,
  },
};

/**
 * Build capabilities object for useWriteContracts (wagmi/experimental)
 * Only used with Smart Wallet transactions.
 */
export function getPaymasterCapabilities(chainId: number) {
  return {
    [chainId]: PAYMASTER_CAPABILITIES,
  };
}

/**
 * Check if the CDP Paymaster is configured (has a real key)
 */
export function isPaymasterConfigured(): boolean {
  return !CDP_PAYMASTER_URL.includes('YOUR_CDP_KEY');
}

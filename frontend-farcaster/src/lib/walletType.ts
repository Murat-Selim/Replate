'use client';

import { usePublicClient, useAccount } from 'wagmi';
import { useCallback } from 'react';

export type WalletType = 'smart' | 'eoa';

/**
 * Detect if an address is a Smart Wallet (has bytecode or uses Smart Wallet connector) or EOA.
 * Smart Wallets are contract accounts (e.g., Coinbase Smart Wallet).
 * EOAs are regular externally-owned accounts (e.g., MetaMask, Rainbow).
 */
export function useWalletType() {
  const { connector } = useAccount();
  const publicClient = usePublicClient();

  const detectWalletType = useCallback(
    async (address: `0x${string}`): Promise<WalletType> => {
      // If using the Smart Wallet connector, it is always a smart wallet
      if (connector?.id === 'baseAccount' || connector?.id === 'coinbaseWallet') {
        return 'smart';
      }

      if (!publicClient) return 'eoa'; // Default to EOA if no client

      try {
        const bytecode = await publicClient.getCode({ address });
        // If bytecode exists and is not empty, it's a smart wallet (contract account)
        return bytecode && bytecode !== '0x' ? 'smart' : 'eoa';
      } catch (error) {
        console.warn('⚠️ Failed to detect wallet type, defaulting to EOA:', error);
        return 'eoa';
      }
    },
    [connector, publicClient]
  );

  return { detectWalletType };
}

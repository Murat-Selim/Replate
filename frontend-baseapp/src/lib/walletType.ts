'use client';

import { usePublicClient } from 'wagmi';
import { useCallback } from 'react';

export type WalletType = 'smart' | 'eoa';

/**
 * Detect if an address is a Smart Wallet (has bytecode) or EOA (no bytecode).
 * Smart Wallets are contract accounts (e.g., Coinbase Smart Wallet).
 * EOAs are regular externally-owned accounts (e.g., MetaMask, Rainbow).
 */
export function useWalletType() {
  const publicClient = usePublicClient();

  const detectWalletType = useCallback(
    async (address: `0x${string}`): Promise<WalletType> => {
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
    [publicClient]
  );

  return { detectWalletType };
}

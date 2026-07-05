'use client';

import { useState, useCallback } from 'react';
import { useAccount, useSignTypedData, useWriteContract } from 'wagmi';
import { useWalletType, type WalletType } from '@/lib/walletType';
import {
  EIP712_DOMAIN,
  CHECK_IN_TYPES,
  RECEIPT_TYPES,
  buildCheckInMessage,
  buildReceiptMessage,
  createDeadline,
  type ReceiptData,
} from '@/lib/eip712';
import { REPLATE_QUEST_ABI, CONTRACT_ADDRESS } from '@/lib/contract';
import { getApiUrl } from '@/lib/api';

// ─── Types ───────────────────────────────────────────────────────────
interface TransactionResult {
  success: boolean;
  txHash?: string;
  pointsEarned?: number;
  error?: string;
}

// ─── Nonce Helper (from contract directly via backend metadata) ──────
async function fetchNonceFromBackend(address: string): Promise<bigint> {
  const res = await fetch(getApiUrl(`/api/meta/nonce/${address}`));
  const data = await res.json();
  return BigInt(data.nonce || 0);
}

// ─── useCheckIn Hook ─────────────────────────────────────────────────
export function useCheckIn() {
  const { address } = useAccount();
  const { detectWalletType } = useWalletType();
  const { signTypedDataAsync } = useSignTypedData();
  const { writeContractAsync } = useWriteContract();

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [walletType, setWalletType] = useState<WalletType | null>(null);

  const checkIn = useCallback(async (): Promise<TransactionResult> => {
    if (!address) {
      return { success: false, error: 'Wallet not connected' };
    }

    setIsLoading(true);
    setError(null);

    try {
      const wType = await detectWalletType(address);
      setWalletType(wType);

      console.log(`🔷 Wallet detected (${wType}) — using EIP-712 + direct contract call (user-attributed tx)`);

      // 1. Get nonce from contract (via backend meta helper)
      const nonce = await fetchNonceFromBackend(address);
      const deadline = createDeadline(5);

      // 2. Build & sign EIP-712 message
      const message = buildCheckInMessage(address, nonce, deadline);

      const signature = await signTypedDataAsync({
        domain: EIP712_DOMAIN,
        types: CHECK_IN_TYPES,
        primaryType: 'CheckIn',
        message,
      });

      // 3. EOA or Smart Wallet calls checkInWithSig directly
      //    → from = user's wallet address → Base App counts as unique user ✅
      const txHash = await writeContractAsync({
        address: CONTRACT_ADDRESS,
        abi: REPLATE_QUEST_ABI,
        functionName: 'checkInWithSig',
        args: [address, deadline, signature],
      });

      return { success: true, txHash, pointsEarned: 10 };
    } catch (err: any) {
      const errorMsg = err?.message || 'Check-in failed';
      setError(errorMsg);
      console.error('❌ Check-in error:', err);
      return { success: false, error: errorMsg };
    } finally {
      setIsLoading(false);
    }
  }, [address, detectWalletType, signTypedDataAsync, writeContractAsync]);

  return { checkIn, isLoading, error, walletType };
}

// ─── useSubmitReceipt Hook ───────────────────────────────────────────
export function useSubmitReceipt() {
  const { address } = useAccount();
  const { detectWalletType } = useWalletType();
  const { signTypedDataAsync } = useSignTypedData();
  const { writeContractAsync } = useWriteContract();

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [walletType, setWalletType] = useState<WalletType | null>(null);

  const submitReceipt = useCallback(
    async (receiptData: ReceiptData): Promise<TransactionResult> => {
      if (!address) {
        return { success: false, error: 'Wallet not connected' };
      }

      setIsLoading(true);
      setError(null);

      try {
        const wType = await detectWalletType(address);
        setWalletType(wType);

        console.log(`🔷 Wallet detected (${wType}) — using EIP-712 + direct contract call for receipt (user-attributed tx)`);

        // 1. Get nonce from contract (via backend meta helper)
        const nonce = await fetchNonceFromBackend(address);
        const deadline = createDeadline(5);

        // 2. Build & sign EIP-712 message
        const message = buildReceiptMessage(address, receiptData, nonce, deadline);

        const signature = await signTypedDataAsync({
          domain: EIP712_DOMAIN,
          types: RECEIPT_TYPES,
          primaryType: 'SubmitReceipt',
          message,
        });

        // 3. EOA or Smart Wallet calls submitReceiptWithSig directly
        //    → from = user's wallet address → Base App counts as unique user ✅
        const txHash = await writeContractAsync({
          address: CONTRACT_ADDRESS,
          abi: REPLATE_QUEST_ABI,
          functionName: 'submitReceiptWithSig',
          args: [
            address,
            receiptData.totalItems,
            receiptData.healthyItems,
            receiptData.unhealthyItems,
            receiptData.fruitVegGrams,
            receiptData.householdSize,
            receiptData.daysCovered,
            deadline,
            signature,
          ],
        });

        return { success: true, txHash };
      } catch (err: any) {
        const errorMsg = err?.message || 'Receipt submission failed';
        setError(errorMsg);
        console.error('❌ Receipt submission error:', err);
        return { success: false, error: errorMsg };
      } finally {
        setIsLoading(false);
      }
    },
    [address, detectWalletType, signTypedDataAsync, writeContractAsync]
  );

  return { submitReceipt, isLoading, error, walletType };
}

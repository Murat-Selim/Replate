'use client';

import { useState, useCallback } from 'react';
import { useAccount, useSignTypedData, useWriteContract, usePublicClient } from 'wagmi';
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
import { getPaymasterCapabilities, isPaymasterConfigured } from '@/lib/paymaster';
import { REPLATE_QUEST_ABI, CONTRACT_ADDRESS } from '@/lib/contract';
import { appChain } from '@/lib/network';
import { getApiUrl } from '@/lib/api';

// ─── Types ───────────────────────────────────────────────────────────
interface TransactionResult {
  success: boolean;
  txHash?: string;
  pointsEarned?: number;
  error?: string;
}

// ─── Nonce Helper ────────────────────────────────────────────────────
async function fetchNonce(address: string): Promise<bigint> {
  const res = await fetch(getApiUrl(`/api/meta/nonce/${address}`));
  const data = await res.json();
  return BigInt(data.nonce || 0);
}

// ─── useCheckIn Hook ─────────────────────────────────────────────────
export function useCheckIn() {
  const { address } = useAccount();
  const publicClient = usePublicClient();
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

      if (wType === 'smart') {
        // ── Smart Wallet → ERC-4337 direct contract call ──
        console.log('🔷 Smart Wallet detected — using ERC-4337');

        const txHash = await writeContractAsync({
          address: CONTRACT_ADDRESS,
          abi: REPLATE_QUEST_ABI,
          functionName: 'checkIn',
          args: [address],
        });

        return { success: true, txHash, pointsEarned: 10 };
      } else {
        // ── EOA → EIP-712 sign + backend relay ──
        console.log('🔶 EOA detected — using EIP-712');

        const nonce = await fetchNonce(address);
        const deadline = createDeadline(5);

        const message = buildCheckInMessage(address, nonce, deadline);

        const signature = await signTypedDataAsync({
          domain: EIP712_DOMAIN,
          types: CHECK_IN_TYPES,
          primaryType: 'CheckIn',
          message,
        });

        // Send to backend for relay
        const res = await fetch(getApiUrl('/api/meta/checkin-sig'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userAddress: address,
            nonce: nonce.toString(),
            deadline: deadline.toString(),
            signature,
          }),
        });

        const data = await res.json();

        if (!res.ok || !data.success) {
          throw new Error(data.error || 'Check-in failed');
        }

        return {
          success: true,
          txHash: data.data?.txHash,
          pointsEarned: data.data?.pointsEarned || 10,
        };
      }
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
  const publicClient = usePublicClient();
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

        if (wType === 'smart') {
          // ── Smart Wallet → ERC-4337 direct contract call ──
          console.log('🔷 Smart Wallet — using ERC-4337 for receipt');

          const txHash = await writeContractAsync({
            address: CONTRACT_ADDRESS,
            abi: REPLATE_QUEST_ABI,
            functionName: 'submitReceipt',
            args: [
              address,
              receiptData.totalItems,
              receiptData.healthyItems,
              receiptData.unhealthyItems,
              receiptData.fruitVegGrams,
              receiptData.householdSize,
              receiptData.daysCovered,
            ],
          });

          return { success: true, txHash };
        } else {
          // ── EOA → EIP-712 sign + backend relay ──
          console.log('🔶 EOA — using EIP-712 for receipt');

          const nonce = await fetchNonce(address);
          const deadline = createDeadline(5);

          const message = buildReceiptMessage(address, receiptData, nonce, deadline);

          const signature = await signTypedDataAsync({
            domain: EIP712_DOMAIN,
            types: RECEIPT_TYPES,
            primaryType: 'SubmitReceipt',
            message,
          });

          // Send to backend for relay
          const res = await fetch(getApiUrl('/api/meta/receipt-sig'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userAddress: address,
              ...receiptData,
              nonce: nonce.toString(),
              deadline: deadline.toString(),
              signature,
            }),
          });

          const data = await res.json();

          if (!res.ok || !data.success) {
            throw new Error(data.error || 'Receipt submission failed');
          }

          return {
            success: true,
            txHash: data.data?.txHash,
            pointsEarned: data.data?.pointsEarned,
          };
        }
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

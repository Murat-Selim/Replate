'use client';

import { useState, useCallback } from 'react';
import { useAccount, useConnection, useSignTypedData, useWalletClient, useWriteContract, useSwitchChain, usePublicClient } from 'wagmi';
import { concat, encodeFunctionData } from 'viem';
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
import { appChain } from '@/lib/network';
import { DATA_SUFFIX } from '@/lib/config';

// Types
interface TransactionResult {
  success: boolean;
  txHash?: string;
  pointsEarned?: number;
  error?: string;
}

// useCheckIn Hook
export function useCheckIn() {
  const { address, chainId } = useAccount();
  const { connector } = useConnection();
  const { data: walletClient } = useWalletClient({ chainId: appChain.id });
  const publicClient = usePublicClient({ chainId: appChain.id });
  const { signTypedDataAsync } = useSignTypedData();
  const { writeContractAsync } = useWriteContract();
  const { switchChainAsync } = useSwitchChain();

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkIn = useCallback(async (): Promise<TransactionResult> => {
    if (!address) {
      return { success: false, error: 'Wallet not connected' };
    }

    setIsLoading(true);
    setError(null);

    if (!publicClient) {
      return { success: false, error: 'RPC Provider not available' };
    }

    try {
      // Switch chain automatically if connected to wrong network
      if (chainId !== appChain.id && switchChainAsync) {
        console.log(`Switching network to ${appChain.name} (Chain ID: ${appChain.id})...`);
        await switchChainAsync({ chainId: appChain.id });
      }

      // 1. Nonce directly from contract
      const rawNonce = await publicClient!.readContract({
        address: CONTRACT_ADDRESS,
        abi: REPLATE_QUEST_ABI,
        functionName: 'nonces',
        args: [address],
      });
      const nonce = rawNonce as bigint;
      const deadline = createDeadline(5);

      console.log(`Check-in: nonce=${nonce}, deadline=${deadline}`);

      // 2. Build & sign EIP-712 message
      const message = buildCheckInMessage(address, nonce, deadline);

      const signature = await signTypedDataAsync({
        domain: EIP712_DOMAIN,
        types: CHECK_IN_TYPES,
        primaryType: 'CheckIn',
        message,
      });

      // 3. Call checkInWithSig directly
      const callData = encodeFunctionData({
        abi: REPLATE_QUEST_ABI,
        functionName: 'checkInWithSig',
        args: [address, deadline, signature],
      });
      const txHash = connector?.id === 'baseAccount' && walletClient
        ? (await walletClient.sendCallsSync({
            account: address,
            chain: appChain,
            calls: [{ to: CONTRACT_ADDRESS, data: concat([callData, DATA_SUFFIX]) }],
          })).receipts?.[0]?.transactionHash
        : await writeContractAsync({
            address: CONTRACT_ADDRESS,
            abi: REPLATE_QUEST_ABI,
            functionName: 'checkInWithSig',
            chainId: appChain.id,
            args: [address, deadline, signature],
            dataSuffix: DATA_SUFFIX,
          });
      if (!txHash) throw new Error('Wallet did not return a transaction hash');

      // Clear leaderboard cache
      try {
        await fetch(getApiUrl('/api/leaderboard/invalidate'));
      } catch (cacheErr) {
        console.warn('Failed to invalidate leaderboard cache:', cacheErr);
      }

      return { success: true, txHash, pointsEarned: 10 };
    } catch (err: any) {
      const errorMsg = err?.message || 'Check-in failed';
      setError(errorMsg);
      console.error('Check-in error:', err);
      return { success: false, error: errorMsg };
    } finally {
      setIsLoading(false);
    }
  }, [address, chainId, connector, walletClient, switchChainAsync, publicClient, signTypedDataAsync, writeContractAsync]);

  return { checkIn, isLoading, error };
}

// useSubmitReceipt Hook
export function useSubmitReceipt() {
  const { address, chainId } = useAccount();
  const { connector } = useConnection();
  const { data: walletClient } = useWalletClient({ chainId: appChain.id });
  const publicClient = usePublicClient({ chainId: appChain.id });
  const { signTypedDataAsync } = useSignTypedData();
  const { writeContractAsync } = useWriteContract();
  const { switchChainAsync } = useSwitchChain();

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submitReceipt = useCallback(
    async (receiptData: ReceiptData): Promise<TransactionResult> => {
      if (!address) {
        return { success: false, error: 'Wallet not connected' };
      }

      // fruitVegGrams limit check for uint16
      if (receiptData.fruitVegGrams > 65535) {
        return { success: false, error: 'fruitVegGrams too large (max 65535g)' };
      }

      setIsLoading(true);
      setError(null);

      if (!publicClient) {
        return { success: false, error: 'RPC Provider not available' };
      }

      try {
        // Switch chain automatically if connected to wrong network
        if (chainId !== appChain.id && switchChainAsync) {
          console.log(`Switching network to ${appChain.name} (Chain ID: ${appChain.id})...`);
          await switchChainAsync({ chainId: appChain.id });
        }

        // 1. Nonce directly from contract
        const rawNonce = await publicClient!.readContract({
          address: CONTRACT_ADDRESS,
          abi: REPLATE_QUEST_ABI,
          functionName: 'nonces',
          args: [address],
        });
        const nonce = rawNonce as bigint;
        const deadline = createDeadline(5);

        console.log(`Submit receipt: nonce=${nonce}, deadline=${deadline}`);

        // 2. Build & sign EIP-712 message
        const message = buildReceiptMessage(address, receiptData, nonce, deadline);

        const signature = await signTypedDataAsync({
          domain: EIP712_DOMAIN,
          types: RECEIPT_TYPES,
          primaryType: 'SubmitReceipt',
          message,
        });

        // 3. Backend adds the validator attestation and relays the transaction.
        const relayResponse = await fetch(getApiUrl('/api/meta/receipt-sig'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userAddress: address,
            receiptHash: receiptData.receiptHash,
            totalItems: receiptData.totalItems,
            healthyItems: receiptData.healthyItems,
            unhealthyItems: receiptData.unhealthyItems,
            fruitVegGrams: receiptData.fruitVegGrams,
            householdSize: receiptData.householdSize,
            daysCovered: receiptData.daysCovered,
            nonce: nonce.toString(),
            deadline: Number(deadline),
            signature,
          }),
        });
        const relayData = await relayResponse.json();
        if (!relayResponse.ok || !relayData.success) {
          throw new Error(relayData.error || 'Receipt relay failed');
        }
        const txHash = relayData.data?.txHash;
        if (!txHash) throw new Error('Receipt relay did not return a transaction hash');

        const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
        if (receipt.status !== 'success') {
          return { success: false, error: 'Receipt transaction was reverted. No XP was awarded.' };
        }

        // Clear leaderboard cache
        try {
          await fetch(getApiUrl('/api/leaderboard/invalidate'));
        } catch (cacheErr) {
          console.warn('Failed to invalidate leaderboard cache:', cacheErr);
        }

        return { success: true, txHash };
      } catch (err: any) {
        const errorMsg = err?.message || 'Receipt submission failed';
        setError(errorMsg);
        console.error('Receipt submission error:', err);
        return { success: false, error: errorMsg };
      } finally {
        setIsLoading(false);
      }
    },
    [address, chainId, connector, walletClient, switchChainAsync, publicClient, signTypedDataAsync, writeContractAsync]
  );

  return { submitReceipt, isLoading, error };
}

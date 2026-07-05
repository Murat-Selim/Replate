'use client';

import { CONTRACT_ADDRESS } from '@/lib/network';
import { appChain } from '@/lib/network';

// ─── EIP-712 Domain ──────────────────────────────────────────────────
export const EIP712_DOMAIN = {
  name: 'ReplateQuest' as const,
  version: '1' as const,
  chainId: appChain.id,
  verifyingContract: CONTRACT_ADDRESS,
} as const;

// ─── EIP-712 Types ───────────────────────────────────────────────────
export const CHECK_IN_TYPES = {
  CheckIn: [
    { name: 'user', type: 'address' },
    { name: 'nonce', type: 'uint256' },
    { name: 'deadline', type: 'uint256' },
  ],
} as const;

export const RECEIPT_TYPES = {
  SubmitReceipt: [
    { name: 'user', type: 'address' },
    { name: 'totalItems', type: 'uint8' },
    { name: 'healthyItems', type: 'uint8' },
    { name: 'unhealthyItems', type: 'uint8' },
    { name: 'fruitVegGrams', type: 'uint16' },
    { name: 'householdSize', type: 'uint8' },
    { name: 'daysCovered', type: 'uint8' },
    { name: 'nonce', type: 'uint256' },
    { name: 'deadline', type: 'uint256' },
  ],
} as const;

// ─── Deadline Helper ─────────────────────────────────────────────────
/**
 * Create a deadline timestamp 5 minutes in the future.
 * Gives enough time for the user to sign and the backend to relay.
 */
export function createDeadline(minutesFromNow = 5): bigint {
  return BigInt(Math.floor(Date.now() / 1000) + minutesFromNow * 60);
}

// ─── Message Builders ────────────────────────────────────────────────

export function buildCheckInMessage(user: `0x${string}`, nonce: bigint, deadline: bigint) {
  return {
    user,
    nonce,
    deadline,
  };
}

export interface ReceiptData {
  totalItems: number;
  healthyItems: number;
  unhealthyItems: number;
  fruitVegGrams: number;
  householdSize: number;
  daysCovered: number;
}

export function buildReceiptMessage(
  user: `0x${string}`,
  data: ReceiptData,
  nonce: bigint,
  deadline: bigint
) {
  return {
    user,
    totalItems: data.totalItems,
    healthyItems: data.healthyItems,
    unhealthyItems: data.unhealthyItems,
    fruitVegGrams: data.fruitVegGrams,
    householdSize: data.householdSize,
    daysCovered: data.daysCovered,
    nonce,
    deadline,
  };
}

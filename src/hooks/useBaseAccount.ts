"use client";

import { useAccount } from "wagmi";

export function useBaseAccount() {
  const { address, isConnected, status } = useAccount();

  return {
    address,
    isConnected,
    isConnecting: status === "connecting",
  };
}

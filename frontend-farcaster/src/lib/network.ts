import { base, baseSepolia, type Chain } from "wagmi/chains";

const DEFAULT_CHAIN = "baseMainnet";
const DEFAULT_CONTRACT_ADDRESS = "0xb9b7BD63E098ABd55605312933899fC4f3EF59F8";

function resolveChain(): Chain {
  const chainName = process.env.NEXT_PUBLIC_CHAIN?.trim() || DEFAULT_CHAIN;
  return chainName === "base" || chainName === "baseMainnet" ? base : baseSepolia;
}

export const appChain = resolveChain();

export const CONTRACT_ADDRESS =
  (process.env.NEXT_PUBLIC_CONTRACT_ADDRESS?.trim() || DEFAULT_CONTRACT_ADDRESS) as `0x${string}`;

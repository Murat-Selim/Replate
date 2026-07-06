import { base, baseSepolia, type Chain } from "wagmi/chains";

const DEFAULT_CHAIN = "baseMainnet";
// Güncel kontrat adresi — .env.local yoksa bu kullanılır
const DEFAULT_CONTRACT_ADDRESS = "0x9d646D474ba0D1bF03E61453898c160b7f9e3E90";

function resolveChain(): Chain {
  const chainName = process.env.NEXT_PUBLIC_CHAIN?.trim() || DEFAULT_CHAIN;
  return chainName === "base" || chainName === "baseMainnet" ? base : baseSepolia;
}

export const appChain = resolveChain();

export const CONTRACT_ADDRESS =
  (process.env.NEXT_PUBLIC_CONTRACT_ADDRESS?.trim() || DEFAULT_CONTRACT_ADDRESS) as `0x${string}`;

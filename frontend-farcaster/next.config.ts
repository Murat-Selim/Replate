import type { NextConfig } from "next";
import deployment from "../deployment.json";

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_DEPLOYMENT_CHAIN: deployment.chain,
    NEXT_PUBLIC_DEPLOYMENT_CHAIN_ID: String(deployment.chainId),
    NEXT_PUBLIC_DEPLOYMENT_CONTRACT_ADDRESS: deployment.contractAddress,
    NEXT_PUBLIC_DEPLOYMENT_ABI_VERSION: deployment.abiVersion,
  },
  experimental: {
    workerThreads: true,
  },
};

export default nextConfig;

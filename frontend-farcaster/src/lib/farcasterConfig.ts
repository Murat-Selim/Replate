"use client";

import { createConfig, http } from "wagmi";
import { farcasterMiniApp } from "@farcaster/miniapp-wagmi-connector";
import { appChain } from "@/lib/network";

export const wagmiConfig = createConfig({
  chains: [appChain],
  transports: {
    [appChain.id]: http(),
  },
  connectors: [
    farcasterMiniApp(),
  ],
});

"use client";

import { createConfig, http } from "wagmi";
import { farcasterMiniApp } from "@farcaster/miniapp-wagmi-connector";
import { injected } from "wagmi/connectors";
import { appChain } from "@/lib/network";

export const wagmiConfig = createConfig({
  chains: [appChain],
  transports: {
    [appChain.id]: http(),
  },
  connectors: [
    farcasterMiniApp(),
    injected(),
  ],
});

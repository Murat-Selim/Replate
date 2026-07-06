"use client";

import { createConfig, http } from "wagmi";
import { farcasterMiniApp } from "@farcaster/miniapp-wagmi-connector";
import { injected } from "wagmi/connectors";
import { appChain } from "@/lib/network";
import { Attribution } from 'ox/erc8021';

const DATA_SUFFIX = Attribution.toDataSuffix({
  codes: ['bc_7to91eav'],
});

export const wagmiConfig = createConfig({
  chains: [appChain],
  transports: {
    [appChain.id]: http(),
  },
  connectors: [
    farcasterMiniApp(),
    injected(),
  ],
  dataSuffix: DATA_SUFFIX,
});


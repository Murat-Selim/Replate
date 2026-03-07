"use client";

import { createConfig, http } from "wagmi";
import { base, optimism } from "wagmi/chains";
import { baseAccount } from "wagmi/connectors";
import { farcasterMiniApp } from "@farcaster/miniapp-wagmi-connector";

const appName = "Replate";
const appLogoUrl =
  process.env.NEXT_PUBLIC_APP_LOGO_URL || "https://replate61.vercelapp/replate-logo.png";

export const wagmiConfig = createConfig({
  chains: [base, optimism],
  transports: {
    [base.id]: http(),
    [optimism.id]: http(),
  },
  connectors: [
    farcasterMiniApp(),
    baseAccount({
      appName,
      appLogoUrl,
    }),
  ],
});

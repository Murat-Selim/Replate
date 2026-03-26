"use client";
import { createConfig, http } from "wagmi";
import { base, optimism } from "wagmi/chains";
import { baseAccount } from "wagmi/connectors";
import { farcasterMiniApp } from "@farcaster/miniapp-wagmi-connector";
import { Attribution } from "ox/erc8021";
const appName = "Replate";
const appLogoUrl = process.env.NEXT_PUBLIC_APP_LOGO_URL || "https://replate61.vercel.app/replate-logo.png";
// Builder Code from base.dev — auto-appended to all transactions
const DATA_SUFFIX = Attribution.toDataSuffix({
    codes: ["bc_rxpy1v2x"],
});
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
    dataSuffix: DATA_SUFFIX,
});

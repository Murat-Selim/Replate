"use client";

import { useEffect } from "react";
import { sdk } from "@farcaster/miniapp-sdk";
import { useConnect, useAccount } from "wagmi";

export default function MiniAppReady() {
    const { connect, connectors } = useConnect();
    const { isConnected } = useAccount();

    useEffect(() => {
        sdk.actions.ready();
    }, []);

    // Auto-connect wallet when inside Farcaster miniapp
    useEffect(() => {
        if (isConnected) return;

        const autoConnect = async () => {
            try {
                const context = await sdk.context;
                if (context?.user) {
                    // We're inside Farcaster — find the miniapp connector and connect
                    const farcasterConnector = connectors.find(
                        (c) => c.id === "farcasterMiniApp" || c.name.toLowerCase().includes("farcaster")
                    );
                    if (farcasterConnector) {
                        connect({ connector: farcasterConnector });
                        console.log("🔗 Auto-connecting via Farcaster MiniApp connector...");
                    }
                }
            } catch (err) {
                console.log("Not in MiniApp context, skipping auto-connect");
            }
        };

        autoConnect();
    }, [isConnected, connect, connectors]);

    return null;
}

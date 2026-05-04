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

    // Auto-connect wallet when inside Farcaster miniapp or Base App
    useEffect(() => {
        if (isConnected) return;

        const autoConnect = async () => {
            try {
                const context = await sdk.context;
                if (!context) return;

                const isBase = context?.client?.clientFid === 309857;

                // Try the matching connector first
                const preferredId = isBase ? "baseAccount" : "farcasterMiniApp";
                const fallbackId = isBase ? "farcasterMiniApp" : "baseAccount";

                const preferred = connectors.find(
                    (c) => c.id === preferredId || c.name.toLowerCase().includes(preferredId.toLowerCase())
                );
                const fallback = connectors.find(
                    (c) => c.id === fallbackId || c.name.toLowerCase().includes(fallbackId.toLowerCase())
                );

                const connector = preferred || fallback;
                if (connector) {
                    console.log(`🔗 Auto-connecting via ${connector.id} (isBase: ${isBase})...`);
                    connect({ connector });
                } else {
                    console.log("⚠️ No compatible connector found. Available:", connectors.map(c => c.id));
                }
            } catch (err) {
                console.log("Not in MiniApp context, skipping auto-connect");
            }
        };

        autoConnect();
    }, [isConnected, connect, connectors]);

    return null;
}

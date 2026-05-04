"use client";

import React from "react";
import Image from "next/image";
import { Menu, Wallet } from "lucide-react";
import { useAccount, useConnect, useDisconnect } from "wagmi";
import SideMenu from "@/components/SideMenu";

export default function Header() {
    const [isMenuOpen, setIsMenuOpen] = React.useState(false);
    const { address, isConnected } = useAccount();
    const { connect, connectors } = useConnect();
    const { disconnect } = useDisconnect();

    const handleConnect = () => {
        // Find baseAccount connector if available, otherwise use first injected
        const connector = connectors.find(c => c.id === 'baseAccount') || connectors[0];
        if (connector) {
            connect({ connector });
        }
    };

    const walletDisplay = address ? `${address.slice(0, 6)}...${address.slice(-4)}` : "";

    return (
        <>
            {/* Mobile-only header */}
            <header className="lg:hidden fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 sm:px-6 py-3 bg-white/80 backdrop-blur-xl border-b border-brand-accent/20">
                <div className="flex items-center gap-3">
                    <div className="relative w-9 h-9 rounded-xl overflow-hidden shadow-md">
                        <Image
                            src="/replate-image.png"
                            alt="Replate Logo"
                            width={36}
                            height={36}
                            className="object-cover"
                        />
                    </div>
                    <div className="flex flex-col">
                        <span className="font-black text-brand-primary text-sm tracking-tight leading-none">
                            Replate
                        </span>
                        <span className="text-[9px] text-brand-text/40 font-bold uppercase tracking-widest mt-0.5">
                            Onchain
                        </span>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {isConnected ? (
                        <button
                            onClick={() => disconnect()}
                            className="flex items-center gap-2 px-3 py-2 bg-brand-accent rounded-full border border-brand-primary/10 transition-all hover:bg-brand-primary/5 active:scale-95"
                        >
                            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                            <span className="text-[10px] font-bold text-brand-primary">
                                {walletDisplay}
                            </span>
                        </button>
                    ) : (
                        <button
                            onClick={handleConnect}
                            className="flex items-center gap-2 px-4 py-2 bg-brand-primary text-white rounded-full transition-all hover:shadow-lg active:scale-95 shadow-md"
                        >
                            <Wallet size={14} />
                            <span className="text-xs font-bold">Connect</span>
                        </button>
                    )}
                    <button
                        onClick={() => setIsMenuOpen(true)}
                        className="w-10 h-10 flex items-center justify-center text-brand-primary hover:bg-brand-accent/50 rounded-full transition-colors active:scale-90"
                    >
                        <Menu size={22} />
                    </button>
                </div>
            </header>
            <SideMenu isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} />
        </>
    );
}

"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { LayoutGrid, ShoppingBag, BarChart3, User, Wallet } from "lucide-react";
import { useAccount, useConnect, useDisconnect } from "wagmi";

const navItems = [
    { icon: LayoutGrid, href: "/", label: "Home", desc: "Overview & start" },
    { icon: ShoppingBag, href: "/shop", label: "Shop & Verify", desc: "Upload receipts" },
    { icon: BarChart3, href: "/leaderboard", label: "Leaderboard", desc: "Rankings & prizes" },
    { icon: User, href: "/impact", label: "Your Impact", desc: "Stats & streaks" },
];

export default function DesktopSidebar() {
    const pathname = usePathname();
    const { address, isConnected } = useAccount();
    const { connect, connectors } = useConnect();
    const { disconnect } = useDisconnect();

    const handleConnect = () => {
        const connector = connectors.find(c => c.id === 'baseAccount') || connectors[0];
        if (connector) connect({ connector });
    };

    const walletDisplay = address ? `${address.slice(0, 6)}...${address.slice(-4)}` : "";

    return (
        <aside className="hidden lg:flex fixed left-0 top-0 bottom-0 w-[260px] z-40 flex-col bg-white/80 backdrop-blur-xl border-r border-brand-accent/30">
            {/* Logo */}
            <div className="p-6 pb-2">
                <Link href="/" className="flex items-center gap-3 group">
                    <div className="relative w-11 h-11 rounded-2xl overflow-hidden shadow-lg group-hover:shadow-xl transition-shadow">
                        <Image
                            src="/replate-image.png"
                            alt="Replate Logo"
                            width={44}
                            height={44}
                            className="object-cover"
                        />
                    </div>
                    <div className="flex flex-col">
                        <span className="font-black text-brand-primary text-lg tracking-tight leading-none">
                            Replate
                        </span>
                        <span className="text-[10px] text-brand-text/40 font-bold uppercase tracking-widest mt-0.5">
                            Onchain
                        </span>
                    </div>
                </Link>
            </div>

            {/* Navigation */}
            <nav className="flex-1 px-3 py-4 space-y-1">
                {navItems.map((item) => {
                    const isActive = pathname === item.href;
                    const Icon = item.icon;
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`flex items-center gap-3 px-4 py-3 rounded-2xl transition-all duration-200 group ${
                                isActive
                                    ? "bg-brand-primary text-white shadow-lg shadow-brand-primary/20"
                                    : "text-brand-text/70 hover:bg-brand-accent hover:text-brand-primary"
                            }`}
                        >
                            <div
                                className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors ${
                                    isActive
                                        ? "bg-white/20"
                                        : "bg-brand-accent group-hover:bg-brand-primary/10"
                                }`}
                            >
                                <Icon size={18} strokeWidth={isActive ? 2.5 : 2} />
                            </div>
                            <div className="flex flex-col">
                                <span className="text-sm font-bold leading-tight">{item.label}</span>
                                <span
                                    className={`text-[10px] leading-tight ${
                                        isActive ? "text-white/60" : "text-brand-text/40"
                                    }`}
                                >
                                    {item.desc}
                                </span>
                            </div>
                        </Link>
                    );
                })}
            </nav>

            {/* Wallet Section */}
            <div className="p-4 border-t border-brand-accent/30">
                {isConnected ? (
                    <button
                        onClick={() => disconnect()}
                        className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl bg-brand-accent/50 hover:bg-brand-accent transition-all group"
                    >
                        <div className="w-9 h-9 rounded-xl bg-green-100 flex items-center justify-center">
                            <div className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse" />
                        </div>
                        <div className="flex flex-col text-left">
                            <span className="text-xs font-bold text-brand-primary">{walletDisplay}</span>
                            <span className="text-[10px] text-brand-text/40 group-hover:text-red-400 transition-colors">
                                Click to disconnect
                            </span>
                        </div>
                    </button>
                ) : (
                    <button
                        onClick={handleConnect}
                        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-brand-primary text-white rounded-2xl font-bold text-sm hover:bg-brand-secondary transition-all shadow-lg shadow-brand-primary/20 active:scale-[0.98]"
                    >
                        <Wallet size={16} />
                        Connect Wallet
                    </button>
                )}
            </div>
        </aside>
    );
}

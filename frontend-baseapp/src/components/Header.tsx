"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, ShoppingCart, Trophy, User, Wallet, Menu } from "lucide-react";
import { useAccount, useConnect, useDisconnect } from "wagmi";
import SideMenu from "@/components/SideMenu";

export default function Header() {
    const [isMenuOpen, setIsMenuOpen] = React.useState(false);
    const [showWalletModal, setShowWalletModal] = React.useState(false);
    const [mounted, setMounted] = React.useState(false);
    const pathname = usePathname();
    const { address, isConnected, isConnecting, isReconnecting } = useAccount();
    const { connect, connectors } = useConnect();
    const { disconnect } = useDisconnect();

    React.useEffect(() => {
        setMounted(true);
    }, []);

    const walletDisplay = address ? `${address.slice(0, 6)}...${address.slice(-4)}` : "";

    const navItems = [
        { href: "/", label: "Home", icon: Home },
        { href: "/shop", label: "Shop", icon: ShoppingCart },
        { href: "/leaderboard", label: "Leaderboard", icon: Trophy },
        { href: "/impact", label: "Profile", icon: User },
    ];

    return (
        <>
            <header className="fixed top-0 left-0 right-0 z-50 bg-[#050806]/85 backdrop-blur-xl border-b border-[rgba(0,227,110,0.08)] py-4 px-6">
                <div className="max-w-7xl mx-auto flex items-center justify-between w-full">
                    {/* Left: Brand Logo & Name */}
                    <Link href="/" className="flex items-center gap-3 group">
                        <div className="relative flex items-center justify-center">
                            <img
                                src="/replate-image.png"
                                alt="Replate Logo"
                                className="w-11 h-11 object-contain drop-shadow-[0_0_6px_rgba(0,227,110,0.3)]"
                            />
                        </div>
                        <span className="font-black text-white text-xl tracking-tight transition-colors group-hover:text-[#00E36E]">
                            Replate
                        </span>
                    </Link>

                    {/* Center: Navigation Links (Desktop) */}
                    <nav className="hidden md:flex items-center gap-8">
                        {navItems.map((item) => {
                            const isActive = pathname === item.href;
                            const Icon = item.icon;
                            return (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    className={`relative flex items-center gap-2 py-1.5 font-semibold text-sm transition-all duration-200 ${isActive ? "text-[#00E36E] drop-shadow-[0_0_4px_rgba(0,227,110,0.3)]" : "text-[#8c9790] hover:text-white"
                                        }`}
                                >
                                    <Icon size={16} strokeWidth={isActive ? 2.5 : 2} />
                                    <span>{item.label}</span>
                                    {isActive && (
                                        <div className="absolute bottom-[-18px] left-0 right-0 h-[2px] bg-[#00E36E] rounded-full shadow-[0_0_10px_#00E36E]" />
                                    )}
                                </Link>
                            );
                        })}
                    </nav>

                    {/* Right: Wallet Connect & Hamburger (Mobile) */}
                    <div className="flex items-center gap-3">
                        {!mounted ? (
                            <button
                                className="flex items-center gap-2 px-4 sm:px-5 py-2 sm:py-2.5 bg-[#00E36E]/40 text-[#050806]/50 rounded-xl font-black text-xs sm:text-sm cursor-not-allowed opacity-60 animate-pulse"
                                disabled
                            >
                                <Wallet size={16} className="opacity-40" />
                                <span>Loading...</span>
                            </button>
                        ) : isReconnecting || isConnecting ? (
                            <button
                                className="flex items-center gap-2 px-4 sm:px-5 py-2 sm:py-2.5 bg-[#00E36E]/40 text-[#050806]/70 rounded-xl font-black text-xs sm:text-sm cursor-not-allowed"
                                disabled
                            >
                                <div className="w-3.5 h-3.5 border-2 border-[#050806]/30 border-t-[#050806] rounded-full animate-spin" />
                                <span>Connecting...</span>
                            </button>
                        ) : isConnected ? (
                            <button
                                onClick={() => disconnect()}
                                className="flex items-center gap-2 px-4 py-2 bg-brand-accent/10 border border-[#00E36E]/30 text-[#00E36E] rounded-xl font-bold text-xs sm:text-sm transition-all hover:bg-brand-accent/20 active:scale-95 shadow-[0_0_10px_rgba(0,227,110,0.1)]"
                            >
                                <div className="w-2 h-2 rounded-full bg-[#00E36E] animate-pulse" />
                                <span>{walletDisplay}</span>
                            </button>
                        ) : (
                            <button
                                onClick={() => setShowWalletModal(true)}
                                className="flex items-center gap-2 px-4 sm:px-5 py-2 sm:py-2.5 bg-[#00E36E] hover:bg-[#00FF66] text-[#050806] rounded-xl font-black text-xs sm:text-sm transition-all shadow-[0_0_15px_rgba(0,227,110,0.35)] hover:shadow-[0_0_25px_rgba(0,227,110,0.55)] active:scale-95"
                            >
                                <Wallet size={16} />
                                <span>Connect Wallet</span>
                            </button>
                        )}

                        {/* Hamburger menu for mobile drawer */}
                        <button
                            onClick={() => setIsMenuOpen(true)}
                            className="md:hidden w-10 h-10 flex items-center justify-center text-[#8c9790] hover:text-white bg-brand-accent/10 hover:bg-brand-accent/20 rounded-xl transition-colors active:scale-90"
                        >
                            <Menu size={20} />
                        </button>
                    </div>
                </div>
            </header>
            <SideMenu isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} />

            {/* Wallet Selection Modal */}
            {showWalletModal && (
                <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
                    {/* Backdrop */}
                    <div 
                        className="fixed inset-0 bg-black/85 backdrop-blur-md transition-opacity"
                        onClick={() => setShowWalletModal(false)}
                    ></div>
                    
                    {/* Modal Content */}
                    <div className="relative w-full sm:max-w-sm bg-[#0a0e0c] border border-[#00E36E]/20 backdrop-blur-2xl rounded-t-[32px] sm:rounded-[32px] p-6 shadow-2xl animate-in slide-in-from-bottom duration-300 z-10 space-y-4">
                        <div className="text-center pb-2">
                            <h3 className="text-lg font-black text-white">Connect Wallet</h3>
                            <p className="text-xs text-[#8c9790]">Select a wallet provider to connect</p>
                        </div>
                        
                        <div className="space-y-3">
                            {connectors.map((connector) => {
                                let name = connector.name;
                                if (connector.id === 'injected') {
                                    name = 'Browser Wallet (MetaMask, Rabby, etc.)';
                                } else if (connector.id === 'baseAccount') {
                                    name = 'Coinbase Wallet / Smart Wallet';
                                }
                                
                                return (
                                    <button
                                        key={connector.uid}
                                        onClick={() => {
                                            connect({ connector });
                                            setShowWalletModal(false);
                                        }}
                                        type="button"
                                        className="w-full py-4 px-6 bg-[#00E36E]/5 hover:bg-[#00E36E]/15 text-white hover:text-[#00E36E] rounded-2xl font-extrabold text-sm active:scale-[0.98] transition-all flex items-center justify-center gap-3 border border-[#00E36E]/12 cursor-pointer shadow-md"
                                    >
                                        {name}
                                    </button>
                                );
                            })}
                        </div>
                        
                        <button
                            onClick={() => setShowWalletModal(false)}
                            type="button"
                            className="w-full py-3 px-6 bg-transparent text-[#8c9790] hover:text-white font-bold text-sm transition-colors cursor-pointer"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}
        </>
    );
}

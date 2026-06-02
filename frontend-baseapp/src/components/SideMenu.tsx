"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { X, LayoutGrid, ShoppingBag, BarChart3, User } from "lucide-react";

const menuItems = [
    { icon: LayoutGrid, href: "/", label: "Home" },
    { icon: ShoppingBag, href: "/shop", label: "Shop & Verify" },
    { icon: BarChart3, href: "/leaderboard", label: "Leaderboard" },
    { icon: User, href: "/impact", label: "Your Impact" },
];

interface SideMenuProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function SideMenu({ isOpen, onClose }: SideMenuProps) {
    const pathname = usePathname();

    return (
        <>
            {/* Backdrop */}
            <div
                className={`lg:hidden fixed inset-0 bg-[#050806]/60 backdrop-blur-sm z-[60] transition-opacity duration-300 ${isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
                    }`}
                onClick={onClose}
            />

            {/* Drawer */}
            <div className={`lg:hidden fixed top-0 right-0 h-full w-72 bg-[#0a0e0c] border-l border-[rgba(0,227,110,0.1)] z-[70] shadow-2xl transition-transform duration-500 ease-out transform ${isOpen ? "translate-x-0" : "translate-x-full"
                }`}>
                <div className="p-6 space-y-8 h-full flex flex-col">
                    <div className="flex justify-between items-center">
                        <span className="text-xl font-black text-white">Menu</span>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-[#00E36E]/10 rounded-full transition-colors text-[#8c9790] hover:text-white"
                        >
                            <X size={24} />
                        </button>
                    </div>

                    <nav className="space-y-2 flex-1">
                        {menuItems.map((item) => {
                            const Icon = item.icon;
                            const isActive = pathname === item.href;
                            return (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    onClick={onClose}
                                    className={`flex items-center gap-3 p-3 rounded-2xl transition-all group ${
                                        isActive
                                            ? "bg-[#00E36E] text-[#050806]"
                                            : "hover:bg-white/[0.03]"
                                    }`}
                                >
                                    <div
                                        className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
                                            isActive
                                                ? "bg-white/20 text-[#050806]"
                                                : "bg-[#00E36E]/10 group-hover:bg-[#00E36E]/20 text-[#00E36E]"
                                        }`}
                                    >
                                        <Icon size={20} />
                                    </div>
                                    <span
                                        className={`font-bold text-base ${
                                            isActive ? "text-[#050806]" : "text-[#8c9790] group-hover:text-white"
                                        } transition-colors`}
                                    >
                                        {item.label}
                                    </span>
                                </Link>
                            );
                        })}
                    </nav>

                    <div className="p-5 bg-[#00E36E]/5 border border-[#00E36E]/10 rounded-2xl space-y-1">
                        <p className="text-[10px] font-black uppercase tracking-widest text-[#8c9790]/60">Your Status</p>
                        <p className="font-bold text-[#00E36E] leading-tight">Zero Waste Hero</p>
                    </div>
                </div>
            </div>
        </>
    );
}


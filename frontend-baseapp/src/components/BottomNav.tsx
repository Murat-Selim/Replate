"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGrid, ShoppingBag, BarChart3, Target, User } from "lucide-react";

const navItems = [
    { icon: LayoutGrid, href: "/", label: "Home" },
    { icon: ShoppingBag, href: "/shop", label: "Verify Receipt" },
    { icon: BarChart3, href: "/leaderboard", label: "Leaderboard" },
    { icon: Target, href: "/quests", label: "Quests" },
    { icon: User, href: "/profile", label: "Profile" },
];

export default function BottomNav() {
    const pathname = usePathname();

    return (
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#050806]/95 backdrop-blur-xl border-t border-[rgba(0,227,110,0.1)] px-4 sm:px-6 py-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))]">
            <div className="grid grid-cols-5 max-w-md mx-auto">
                {navItems.map((item) => {
                    const isActive = pathname === item.href;
                    const Icon = item.icon;
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`flex min-w-0 flex-col items-center gap-0.5 rounded-2xl px-1 py-1.5 text-center transition-all ${
                                isActive
                                    ? "text-[#00E36E]"
                                    : "text-[#8c9790] hover:text-[#05CE67]"
                             }`}
                        >
                            <div
                                className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                                    isActive
                                        ? "bg-[#00E36E]/15 scale-110 shadow-[0_0_15px_rgba(0,227,110,0.15)]"
                                        : ""
                                }`}
                            >
                                <Icon size={22} strokeWidth={isActive ? 2.5 : 1.8} />
                            </div>
                            <span
                                className={`w-full text-center text-[10px] font-bold leading-tight tracking-wide transition-all ${
                                    isActive ? "opacity-100" : "opacity-60"
                                }`}
                            >
                                {item.label}
                            </span>
                        </Link>
                    );
                })}
            </div>
        </nav>
    );
}

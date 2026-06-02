"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGrid, ShoppingBag, BarChart3, User } from "lucide-react";

const navItems = [
    { icon: LayoutGrid, href: "/", label: "Home" },
    { icon: ShoppingBag, href: "/shop", label: "Shop" },
    { icon: BarChart3, href: "/leaderboard", label: "Ranks" },
    { icon: User, href: "/impact", label: "Profile" },
];

export default function BottomNav() {
    const pathname = usePathname();

    return (
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#050806]/95 backdrop-blur-xl border-t border-[rgba(0,227,110,0.1)] px-4 sm:px-6 py-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))]">
            <div className="flex items-center justify-around max-w-md mx-auto">
                {navItems.map((item) => {
                    const isActive = pathname === item.href;
                    const Icon = item.icon;
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-2xl transition-all ${
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
                                className={`text-[10px] font-bold tracking-wide transition-all ${
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


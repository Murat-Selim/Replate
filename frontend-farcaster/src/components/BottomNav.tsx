"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Circle, BarChart3, User } from "lucide-react";

const navItems = [
    { icon: Home, href: "/", label: "Home" },
    { icon: Circle, href: "/shop", label: "Shop" },
    { icon: BarChart3, href: "/leaderboard", label: "Leaderboard" },
    { icon: User, href: "/impact", label: "Profile" },
];

export default function BottomNav() {
    const pathname = usePathname();

    return (
        <nav className="fixed bottom-0 left-0 right-0 z-50 bg-[#0B1114]/80 backdrop-blur-lg border-t border-[#22D97A]/10 px-6 py-4 pb-8">
            <div className="flex items-center justify-between max-w-lg mx-auto">
                {navItems.map((item) => {
                    const isActive = pathname === item.href;
                    const Icon = item.icon;
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`flex flex-col items-center gap-1.5 transition-all w-20 ${isActive
                                    ? "text-brand-primary scale-105"
                                    : "text-[#A6B0B5] hover:text-white"
                                }`}
                        >
                            <div className="relative flex items-center justify-center">
                                <Icon size={22} strokeWidth={isActive ? 2.5 : 2} />
                                {isActive && (
                                    <div className="absolute inset-0 bg-brand-primary/20 blur-md rounded-full -z-10"></div>
                                )}
                            </div>
                            <span className={`text-[9px] font-black uppercase tracking-wider transition-colors ${isActive ? "text-brand-primary" : "text-[#A6B0B5]"
                                }`}>
                                {item.label}
                            </span>
                        </Link>
                    );
                })}
            </div>
        </nav>
    );
}

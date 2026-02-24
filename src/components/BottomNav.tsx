"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGrid, Circle, Diamond, BarChart3, User } from "lucide-react";

const navItems = [
    { icon: LayoutGrid, href: "/", label: "Home" },
    { icon: Circle, href: "/shop", label: "Shop" },
    { icon: Diamond, href: "/verify", label: "Verify" },
    { icon: BarChart3, href: "/leaderboard", label: "Ranks" },
    { icon: User, href: "/impact", label: "Profile" },
];

export default function BottomNav() {
    const pathname = usePathname();

    return (
        <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-lg border-t border-brand-accent/30 px-6 py-3 pb-8">
            <div className="flex items-center justify-between max-w-lg mx-auto">
                {navItems.map((item) => {
                    const isActive = pathname === item.href;
                    const Icon = item.icon;
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`flex flex-col items-center gap-1 transition-all ${isActive ? "text-brand-primary scale-110" : "text-gray-400 hover:text-brand-secondary"
                                }`}
                        >
                            <Icon size={24} strokeWidth={isActive ? 2.5 : 2} />
                            {isActive && (
                                <span className="text-[10px] font-bold uppercase tracking-wider">
                                    {item.label}
                                </span>
                            )}
                        </Link>
                    );
                })}
            </div>
        </nav>
    );
}

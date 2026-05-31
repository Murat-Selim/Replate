"use client";

import React from "react";
import Link from "next/link";
import { X, Home, Circle, BarChart3, User } from "lucide-react";

const menuItems = [
    { icon: Home, href: "/", label: "Home" },
    { icon: Circle, href: "/shop", label: "Activity" },
    { icon: BarChart3, href: "/leaderboard", label: "Leaderboard" },
    { icon: User, href: "/impact", label: "Profile" },
];

interface SideMenuProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function SideMenu({ isOpen, onClose }: SideMenuProps) {
    return (
        <>
            {/* Backdrop */}
            <div
                className={`fixed inset-0 bg-[#0B1114]/60 backdrop-blur-sm z-[60] transition-opacity duration-300 ${isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
                    }`}
                onClick={onClose}
            />

            {/* Drawer */}
            <div className={`fixed top-0 right-0 h-full w-72 bg-[#131C20] border-l border-[#22D97A]/10 z-[70] shadow-2xl transition-transform duration-500 ease-out transform ${isOpen ? "translate-x-0" : "translate-x-full"
                }`}>
                <div className="p-8 h-full flex flex-col justify-between overflow-y-auto">
                    <div className="space-y-12">
                        <div className="flex justify-between items-center">
                            <span className="text-2xl font-black text-white font-heading uppercase tracking-wider">Menu</span>
                            <button
                                onClick={onClose}
                                className="p-2 hover:bg-[#1E2A2F] rounded-full transition-colors text-white"
                            >
                                <X size={24} />
                            </button>
                        </div>

                        <nav className="space-y-3">
                            {menuItems.map((item) => {
                                const Icon = item.icon;
                                return (
                                    <Link
                                        key={item.href}
                                        href={item.href}
                                        onClick={onClose}
                                        className="flex items-center gap-4 p-4 rounded-2xl hover:bg-[#1E2A2F] transition-all group border border-transparent hover:border-[#22D97A]/10"
                                    >
                                        <div className="w-10 h-10 rounded-xl bg-[#1E2A2F] flex items-center justify-center text-[#A6B0B5] group-hover:bg-[#22D97A]/10 group-hover:text-[#22D97A] transition-colors border border-white/5">
                                            <Icon size={18} />
                                        </div>
                                        <span className="font-bold text-base text-[#A6B0B5] group-hover:text-white transition-colors">
                                            {item.label}
                                        </span>
                                    </Link>
                                );
                            })}
                        </nav>
                    </div>

                    <div className="mt-8">
                        <div className="p-6 glass-card rounded-3xl space-y-2 border border-[#22D97A]/10">
                            <p className="text-[10px] font-black uppercase tracking-widest text-[#A6B0B5]">Your Status</p>
                            <p className="font-extrabold text-brand-primary leading-tight text-lg uppercase tracking-wide">Zero Waste Hero</p>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}

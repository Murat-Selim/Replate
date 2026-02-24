"use client";

import React from "react";
import Link from "next/link";
import { X, LayoutGrid, Circle, Diamond, BarChart3, User } from "lucide-react";

const menuItems = [
    { icon: LayoutGrid, href: "/", label: "Home" },
    { icon: Circle, href: "/shop", label: "Shop" },
    { icon: Diamond, href: "/verify", label: "Verify" },
    { icon: BarChart3, href: "/leaderboard", label: "Ranks" },
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
                className={`fixed inset-0 bg-brand-primary/20 backdrop-blur-sm z-[60] transition-opacity duration-300 ${isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
                    }`}
                onClick={onClose}
            />

            {/* Drawer */}
            <div className={`fixed top-0 right-0 h-full w-72 bg-white z-[70] shadow-2xl transition-transform duration-500 ease-out transform ${isOpen ? "translate-x-0" : "translate-x-full"
                }`}>
                <div className="p-8 space-y-12">
                    <div className="flex justify-between items-center">
                        <span className="text-2xl font-black text-brand-primary">Menu</span>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-brand-accent rounded-full transition-colors text-brand-primary"
                        >
                            <X size={28} />
                        </button>
                    </div>

                    <nav className="space-y-4">
                        {menuItems.map((item) => {
                            const Icon = item.icon;
                            return (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    onClick={onClose}
                                    className="flex items-center gap-4 p-4 rounded-2xl hover:bg-brand-accent transition-all group"
                                >
                                    <div className="w-10 h-10 rounded-xl bg-brand-accent flex items-center justify-center text-brand-primary group-hover:bg-brand-primary group-hover:text-white transition-colors">
                                        <Icon size={20} />
                                    </div>
                                    <span className="font-bold text-lg text-brand-text group-hover:text-brand-primary transition-colors">
                                        {item.label}
                                    </span>
                                </Link>
                            );
                        })}
                    </nav>

                    <div className="absolute bottom-12 left-8 right-8">
                        <div className="p-6 bg-brand-accent rounded-3xl space-y-2">
                            <p className="text-xs font-black uppercase tracking-widest text-brand-text/30">Your Status</p>
                            <p className="font-bold text-brand-primary leading-tight">Zero Waste Hero</p>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}

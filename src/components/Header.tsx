"use client";

import React from "react";
import { Menu } from "lucide-react";
import SideMenu from "./SideMenu";

export default function Header() {
    const [isMenuOpen, setIsMenuOpen] = React.useState(false);

    return (
        <>
            <header className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-6 bg-brand-background/80 backdrop-blur-md">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-brand-primary flex items-center justify-center text-white font-bold text-lg shadow-sm">
                        U
                    </div>
                    <span className="font-bold text-brand-primary text-sm uppercase tracking-wider">@username</span>
                </div>
                <button
                    onClick={() => setIsMenuOpen(true)}
                    className="p-2 text-brand-primary hover:bg-brand-accent/50 rounded-full transition-colors"
                >
                    <Menu size={28} />
                </button>
            </header>
            <SideMenu isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} />
        </>
    );
}

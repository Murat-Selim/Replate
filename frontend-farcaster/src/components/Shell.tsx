"use client";

import React from "react";
import Header from "./Header";
import BottomNav from "./BottomNav";

export default function Shell({ children }: { children: React.ReactNode }) {
    return (
        <div className="min-h-screen bg-brand-background text-brand-text grid-bg relative overflow-x-hidden">
            {/* Ambient Background Glow */}
            <div className="absolute top-[-10%] left-[-20%] w-[80%] h-[60%] rounded-full bg-brand-primary/5 blur-[120px] pointer-events-none"></div>
            <div className="absolute bottom-[-10%] right-[-20%] w-[80%] h-[60%] rounded-full bg-brand-accent/5 blur-[120px] pointer-events-none"></div>

            <Header />
            <main className="pt-24 pb-32 px-6 max-w-lg mx-auto relative z-10">
                {children}
            </main>
            <BottomNav />
        </div>
    );
}

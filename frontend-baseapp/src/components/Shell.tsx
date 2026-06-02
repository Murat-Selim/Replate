"use client";

import React from "react";
import Header from "./Header";
import BottomNav from "./BottomNav";

export default function Shell({ children }: { children: React.ReactNode }) {
    return (
        <div className="min-h-screen bg-[#050806] text-brand-text grid-bg relative overflow-x-hidden">
            {/* Top Header — unified for mobile and desktop */}
            <Header />

            {/* Main content area */}
            <main className="pt-28 pb-28 px-4 sm:px-6 lg:pb-12 max-w-7xl mx-auto w-full relative z-10">
                {children}
            </main>

            {/* Mobile bottom nav — hidden on desktop */}
            <BottomNav />
        </div>
    );
}




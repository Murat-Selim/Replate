"use client";

import React from "react";
import Header from "./Header";
import BottomNav from "./BottomNav";
import DesktopSidebar from "./DesktopSidebar";

export default function Shell({ children }: { children: React.ReactNode }) {
    return (
        <div className="min-h-screen bg-brand-background text-brand-text">
            {/* Desktop sidebar — hidden on mobile */}
            <DesktopSidebar />

            {/* Mobile header — hidden on desktop */}
            <Header />

            {/* Main content area */}
            <main className="pt-20 pb-28 px-4 sm:px-6 lg:pt-8 lg:pb-8 lg:pl-[280px] lg:pr-8 max-w-7xl mx-auto w-full">
                {children}
            </main>

            {/* Mobile bottom nav — hidden on desktop */}
            <BottomNav />
        </div>
    );
}

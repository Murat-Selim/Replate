"use client";

import React from "react";
import Header from "./Header";
import BottomNav from "./BottomNav";

export default function Shell({ children }: { children: React.ReactNode }) {
    return (
        <div className="min-h-screen bg-brand-background text-brand-text">
            <Header />
            <main className="pt-24 pb-28 px-6 max-w-lg mx-auto">
                {children}
            </main>
            <BottomNav />
        </div>
    );
}

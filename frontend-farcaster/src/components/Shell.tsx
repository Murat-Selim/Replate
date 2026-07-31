"use client";

import React from "react";
import Link from "next/link";
import Header from "./Header";
import BottomNav from "./BottomNav";

const footerLinks = [
    ["Verify Receipt", "/verify-receipt"],
    ["Leaderboard", "/leaderboard"],
    ["Quests", "/quests"],
    ["Profile", "/profile"],
];

export default function Shell({ children }: { children: React.ReactNode }) {
    return (
        <div className="min-h-screen bg-brand-background text-brand-text grid-bg relative overflow-x-hidden">
            <div className="absolute top-[-10%] left-[-20%] w-[80%] h-[60%] rounded-full bg-brand-primary/5 blur-[120px] pointer-events-none"></div>
            <div className="absolute bottom-[-10%] right-[-20%] w-[80%] h-[60%] rounded-full bg-brand-accent/5 blur-[120px] pointer-events-none"></div>
            <Header />
            <main className="pt-24 pb-32 px-6 max-w-lg mx-auto relative z-10">
                {children}
            </main>

            <footer className="border-t border-brand-primary/10 bg-[#0B1114] px-6 py-12">
                <div className="mx-auto grid max-w-5xl gap-10 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
                    <div className="md:-translate-x-8">
                        <Link href="/" className="inline-flex items-center gap-3">
                            <img src="/replate-logo.png" alt="Replate Logo" className="h-10 w-10 object-contain" />
                            <span className="text-xl font-black text-white font-heading">Replate</span>
                        </Link>
                        <p className="mt-4 max-w-sm text-sm leading-7 text-[#A6B0B5]">Turn everyday grocery receipts into healthier insights, less waste, and verifiable progress.</p>
                    </div>
                    <div>
                        <h2 className="text-xs font-black uppercase tracking-[0.2em] text-brand-primary">Explore</h2>
                        <nav className="mt-4 grid gap-3">
                            {footerLinks.map(([label, href]) => <Link key={href} href={href} className="text-sm font-semibold text-[#A6B0B5] transition-colors hover:text-white">{label}</Link>)}
                        </nav>
                    </div>
                    <div>
                        <h2 className="text-xs font-black uppercase tracking-[0.2em] text-brand-primary">Learn & connect</h2>
                        <nav className="mt-4 grid gap-3">
                            <Link href="/whitepaper" className="text-sm font-semibold text-[#A6B0B5] transition-colors hover:text-white">Whitepaper</Link>
                            <Link href="/privacy" className="text-sm font-semibold text-[#A6B0B5] transition-colors hover:text-white">Privacy</Link>
                            <a href="https://github.com/Murat-Selim/Replate" target="_blank" rel="noreferrer" className="text-sm font-semibold text-[#A6B0B5] transition-colors hover:text-white">GitHub</a>
                        </nav>
                    </div>
                    <div>
                        <h2 className="text-xs font-black uppercase tracking-[0.2em] text-brand-primary">Social</h2>
                        <nav className="mt-4 grid gap-3">
                            <a href="https://x.com/replateapp" target="_blank" rel="noreferrer" className="text-sm font-semibold text-[#A6B0B5] transition-colors hover:text-white">X / Replate</a>
                            <a href="https://farcaster.xyz/miniapps/UiovN-lVo6E-/replate" target="_blank" rel="noreferrer" className="text-sm font-semibold text-[#A6B0B5] transition-colors hover:text-white">Farcaster</a>
                            <a href="https://base.app/app/https:/replate-webapp.vercel.app" target="_blank" rel="noreferrer" className="text-sm font-semibold text-[#A6B0B5] transition-colors hover:text-white">Base App</a>
                        </nav>
                    </div>
                </div>
                <div className="mx-auto mt-10 flex max-w-5xl flex-col items-center gap-2 border-t border-white/5 pt-5 text-center text-xs text-[#A6B0B5]/60 sm:items-center sm:justify-center">
                    <span>© 2026 Replate. All rights reserved.</span>
                    <span>Built for healthier, less wasteful shopping.</span>
                </div>
            </footer>

            <BottomNav />
        </div>
    );
}
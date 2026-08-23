"use client";

import React from "react";
import Link from "next/link";
import Header from "./Header";
import BottomNav from "./BottomNav";

const footerLinks = [
    ["Verify Receipt", "/shop"],
    ["Leaderboard", "/leaderboard"],
    ["Quests", "/quests"],
    ["Profile", "/profile"],
];

export default function Shell({ children }: { children: React.ReactNode }) {
    return (
        <div className="min-h-screen bg-[#050806] text-brand-text grid-bg relative overflow-x-hidden">
            <Header />
            <main className="pt-28 pb-28 px-4 sm:px-6 lg:pb-12 max-w-7xl mx-auto w-full relative z-10">
                {children}
            </main>

            <footer className="border-t border-[rgba(0,227,110,0.1)] bg-[#080d0a] px-6 py-12">
                <div className="mx-auto grid max-w-7xl gap-10 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
                    <div>
                        <Link href="/" className="inline-flex items-center gap-3">
                            <img src="/replate-image.png" alt="Replate Logo" className="h-10 w-10 object-contain" />
                            <span className="text-xl font-black text-white">Replate</span>
                        </Link>
                        <p className="mt-4 max-w-sm text-sm leading-7 text-[#8c9790]">Turn everyday grocery receipts into healthier insights, less waste, and verifiable progress.</p>
                    </div>
                    <div>
                        <h2 className="text-xs font-black uppercase tracking-[0.2em] text-[#00E36E]">Explore</h2>
                        <nav className="mt-4 grid gap-3">
                            {footerLinks.map(([label, href]) => <Link key={href} href={href} className="text-sm font-semibold text-[#8c9790] transition-colors hover:text-white">{label}</Link>)}
                        </nav>
                    </div>
                    <div>
                        <h2 className="text-xs font-black uppercase tracking-[0.2em] text-[#00E36E]">Learn & connect</h2>
                        <nav className="mt-4 grid gap-3">
                            <Link href="/whitepaper" className="text-sm font-semibold text-[#8c9790] transition-colors hover:text-white">Whitepaper</Link>
                            <Link href="/privacy" className="text-sm font-semibold text-[#8c9790] transition-colors hover:text-white">Privacy</Link>
                            <a href="https://github.com/Murat-Selim/Replate" target="_blank" rel="noreferrer" className="text-sm font-semibold text-[#8c9790] transition-colors hover:text-white">GitHub</a>
                        </nav>
                    </div>
                    <div>
                        <h2 className="text-xs font-black uppercase tracking-[0.2em] text-[#00E36E]">Social</h2>
                        <nav className="mt-4 grid gap-3">
                            <a href="https://x.com/replateapp" target="_blank" rel="noreferrer" className="text-sm font-semibold text-[#8c9790] transition-colors hover:text-white">X / Replate</a>
                            <a href="https://farcaster.xyz/miniapps/UiovN-lVo6E-/replate" target="_blank" rel="noreferrer" className="text-sm font-semibold text-[#8c9790] transition-colors hover:text-white">Farcaster</a>
                            <a href="https://base.app/app/https:/replate-webapp.vercel.app" target="_blank" rel="noreferrer" className="text-sm font-semibold text-[#8c9790] transition-colors hover:text-white">Base App</a>
                        </nav>
                    </div>
                </div>
                <div className="mx-auto mt-10 flex max-w-7xl flex-col items-center gap-2 border-t border-white/5 pt-5 text-center text-xs text-[#8c9790]/60 sm:items-center sm:justify-center">
                    <span>© 2026 Replate. All rights reserved.</span>
                    <span>Built for healthier, less wasteful shopping.</span>
                </div>
            </footer>

            <BottomNav />
        </div>
    );
}

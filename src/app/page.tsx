"use client";

import Link from "next/link";
import Image from "next/image";
import Shell from "@/components/Shell";
import { Camera, Sparkles, Trophy, ArrowRight } from "lucide-react";

const steps = [
    {
        icon: Camera,
        title: "Snap Your Receipt",
        desc: "Upload any grocery receipt after shopping.",
    },
    {
        icon: Sparkles,
        title: "AI Analyzes It",
        desc: "We score your basket's health & nutrition balance.",
    },
    {
        icon: Trophy,
        title: "Earn Rewards",
        desc: "Get XP, climb the leaderboard, win weekly USDC prizes.",
    },
];

export default function Home() {
    return (
        <Shell>
            <div className="flex flex-col items-center justify-center min-h-[70vh] text-center space-y-10 animate-in fade-in slide-in-from-bottom-6 duration-1000">

                {/* Logo Image */}
                <div className="relative w-48 h-48 flex items-center justify-center">
                    {/* Subtle Outer Glow */}
                    <div className="absolute inset-0 bg-brand-primary/10 rounded-full blur-[60px]"></div>

                    {/* The Logo Image */}
                    <div className="relative w-44 h-44 flex items-center justify-center overflow-hidden rounded-[40px]">
                        <Image
                            src="/replate-image.png"
                            alt="Replate Logo"
                            width={176}
                            height={176}
                            className="object-contain rounded-[40px]"
                            priority
                        />
                    </div>
                </div>

                {/* Hero Text — Sell Point: EARN */}
                <div className="space-y-4">
                    <h1 className="text-6xl font-black tracking-tight text-brand-primary leading-none">
                        Replate
                    </h1>
                    <div className="space-y-1">
                        <p className="text-2xl text-brand-text/90 font-bold tracking-tight">
                            Buy groceries.
                        </p>
                        <p className="text-2xl text-brand-primary font-black tracking-tight">
                            Earn crypto.
                        </p>
                    </div>
                    <p className="text-sm text-brand-text/50 max-w-xs mx-auto leading-relaxed">
                        Get cashback in XP for every healthy grocery run - verified on Base blockchain.
                    </p>
                </div>

                {/* How It Works — 3-Step Flow */}
                <div className="w-full space-y-5 pt-4">
                    <h2 className="text-xs font-black uppercase tracking-[0.2em] text-brand-text/30 text-center">
                        How It Works
                    </h2>

                    <div className="space-y-3">
                        {steps.map((step, i) => {
                            const Icon = step.icon;
                            return (
                                <div
                                    key={i}
                                    className="flex items-start gap-4 bg-white rounded-[24px] p-5 shadow-sm border border-brand-accent/20 text-left"
                                >
                                    <div className="w-12 h-12 shrink-0 bg-brand-accent rounded-2xl flex items-center justify-center text-brand-primary">
                                        <Icon size={24} />
                                    </div>
                                    <div className="space-y-0.5">
                                        <p className="font-bold text-brand-primary text-sm">
                                            {step.title}
                                        </p>
                                        <p className="text-xs text-brand-text/50 leading-snug">
                                            {step.desc}
                                        </p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Trust / Micro Badge */}
                <div className="bg-brand-accent/40 px-5 py-3 rounded-full">
                    <p className="text-[11px] font-semibold text-brand-text/40 tracking-wide">
                        🛡️ Verified on Base · Free to Start · No Hidden Fees
                    </p>
                </div>

                {/* CTA Button */}
                <Link
                    href="/shop"
                    className="w-full max-w-xs bg-brand-primary text-white py-5 px-10 rounded-[32px] font-black text-xl shadow-[0_20px_40px_rgba(26,62,47,0.3)] hover:bg-brand-secondary transition-all active:scale-95 flex items-center justify-center gap-3"
                >
                    Start Earning
                    <ArrowRight size={22} />
                </Link>
            </div>
        </Shell>
    );
}

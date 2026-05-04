"use client";

import Link from "next/link";
import Image from "next/image";
import Shell from "@/components/Shell";
import { Camera, Sparkles, Trophy, ArrowRight, Shield, Zap, TrendingUp } from "lucide-react";

const steps = [
    {
        icon: Camera,
        title: "Snap Your Receipt",
        desc: "Upload any grocery receipt after shopping — our AI reads it instantly.",
        color: "bg-emerald-50 text-emerald-600",
    },
    {
        icon: Sparkles,
        title: "AI Analyzes It",
        desc: "We score your basket's health & nutrition balance using WHO standards.",
        color: "bg-blue-50 text-blue-600",
    },
    {
        icon: Trophy,
        title: "Earn Rewards",
        desc: "Get XP, climb the leaderboard, and win weekly USDC prizes on Base.",
        color: "bg-amber-50 text-amber-600",
    },
];

const stats = [
    { label: "Verified on Base", icon: Shield },
    { label: "Free to Start", icon: Zap },
    { label: "Weekly Prizes", icon: TrendingUp },
];

export default function Home() {
    return (
        <Shell>
            <div className="gradient-hero">
                {/* Hero Section */}
                <section className="flex flex-col lg:flex-row items-center gap-8 lg:gap-16 py-8 lg:py-16">
                    {/* Left: Text Content */}
                    <div className="flex-1 text-center lg:text-left space-y-6 animate-fade-in-up">
                        <div className="space-y-4">
                            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black tracking-tight text-brand-primary leading-[0.95]">
                                Buy groceries.
                                <br />
                                <span className="bg-gradient-to-r from-brand-primary via-emerald-600 to-brand-secondary bg-clip-text text-transparent">
                                    Earn crypto.
                                </span>
                            </h1>
                            <p className="text-base sm:text-lg text-brand-text/60 max-w-md mx-auto lg:mx-0 leading-relaxed">
                                Get cashback in XP for every healthy grocery run — verified on Base blockchain. Shop smarter, earn onchain.
                            </p>
                        </div>

                        <div className="flex flex-col sm:flex-row items-center gap-3 justify-center lg:justify-start">
                            <Link
                                href="/shop"
                                className="w-full sm:w-auto bg-brand-primary text-white py-4 px-8 rounded-2xl font-bold text-lg shadow-xl shadow-brand-primary/20 hover:bg-brand-secondary hover:shadow-2xl hover:shadow-brand-primary/30 transition-all active:scale-[0.98] flex items-center justify-center gap-3"
                            >
                                Start Earning
                                <ArrowRight size={20} />
                            </Link>
                            <Link
                                href="/leaderboard"
                                className="w-full sm:w-auto bg-white text-brand-primary py-4 px-8 rounded-2xl font-bold text-lg border border-brand-accent hover:border-brand-primary/20 transition-all flex items-center justify-center gap-2"
                            >
                                View Leaderboard
                            </Link>
                        </div>

                        {/* Trust Badges */}
                        <div className="flex items-center gap-4 justify-center lg:justify-start pt-2">
                            {stats.map((stat) => {
                                const Icon = stat.icon;
                                return (
                                    <div key={stat.label} className="flex items-center gap-1.5">
                                        <Icon size={14} className="text-brand-primary/40" />
                                        <span className="text-xs font-semibold text-brand-text/40">
                                            {stat.label}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Right: Logo / Visual */}
                    <div className="relative flex items-center justify-center animate-fade-in-up-delay-1">
                        {/* Glow effect */}
                        <div className="absolute w-64 h-64 sm:w-72 sm:h-72 lg:w-80 lg:h-80 bg-brand-primary/5 rounded-full blur-[80px]" />
                        <div className="absolute w-48 h-48 sm:w-56 sm:h-56 lg:w-64 lg:h-64 bg-emerald-400/10 rounded-full blur-[60px] animate-float" />

                        {/* Logo */}
                        <div className="relative w-48 h-48 sm:w-56 sm:h-56 lg:w-64 lg:h-64 rounded-[40px] overflow-hidden shadow-2xl shadow-brand-primary/20 animate-pulse-glow">
                            <Image
                                src="/replate-image.png"
                                alt="Replate Logo"
                                width={256}
                                height={256}
                                className="object-contain w-full h-full"
                                priority
                            />
                        </div>
                    </div>
                </section>

                {/* How It Works */}
                <section className="py-12 lg:py-20 space-y-8 animate-fade-in-up-delay-2">
                    <div className="text-center space-y-2">
                        <h2 className="text-xs font-black uppercase tracking-[0.2em] text-brand-text/30">
                            How It Works
                        </h2>
                        <p className="text-2xl sm:text-3xl font-black text-brand-primary">
                            Three steps to healthier shopping
                        </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 lg:gap-6">
                        {steps.map((step, i) => {
                            const Icon = step.icon;
                            return (
                                <div
                                    key={i}
                                    className="glass-card glass-card-hover rounded-3xl p-6 lg:p-8 text-center sm:text-left space-y-4"
                                >
                                    <div className="flex items-center justify-center sm:justify-start gap-3">
                                        <div
                                            className={`w-12 h-12 ${step.color} rounded-2xl flex items-center justify-center`}
                                        >
                                            <Icon size={22} />
                                        </div>
                                        <span className="text-xs font-black text-brand-text/20 uppercase tracking-widest sm:hidden">
                                            Step {i + 1}
                                        </span>
                                    </div>
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-2">
                                            <span className="hidden sm:inline-block text-xs font-black text-brand-text/20 uppercase tracking-widest">
                                                Step {i + 1}
                                            </span>
                                        </div>
                                        <h3 className="font-bold text-brand-primary text-lg">
                                            {step.title}
                                        </h3>
                                        <p className="text-sm text-brand-text/50 leading-relaxed">
                                            {step.desc}
                                        </p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </section>

                {/* Bottom CTA */}
                <section className="py-8 lg:py-12 animate-fade-in-up-delay-3">
                    <div className="glass-card rounded-3xl p-8 lg:p-12 text-center space-y-6 gradient-mesh">
                        <h2 className="text-2xl sm:text-3xl font-black text-brand-primary">
                            Ready to shop smarter?
                        </h2>
                        <p className="text-brand-text/50 max-w-lg mx-auto">
                            Join thousands of users earning rewards for healthy grocery shopping. Verified on Base blockchain.
                        </p>
                        <Link
                            href="/shop"
                            className="inline-flex items-center gap-3 bg-brand-primary text-white py-4 px-10 rounded-2xl font-bold text-lg shadow-xl shadow-brand-primary/20 hover:bg-brand-secondary hover:shadow-2xl transition-all active:scale-[0.98]"
                        >
                            Get Started
                            <ArrowRight size={20} />
                        </Link>
                    </div>
                </section>
            </div>
        </Shell>
    );
}

"use client";

import Link from "next/link";
import Image from "next/image";
import Shell from "@/components/Shell";
import { 
    Camera, 
    Sparkles, 
    Trophy, 
    ArrowRight, 
    Shield, 
    Lock, 
    Users, 
    Gift, 
    ChevronDown,
    Zap
} from "lucide-react";

export default function Home() {
    return (
        <Shell>
            <div className="space-y-16 lg:space-y-24 relative pb-16">
                {/* Hero Section */}
                <section className="flex flex-col lg:flex-row items-center gap-12 lg:gap-8 py-4 lg:py-8">
                    {/* Left: Text Content */}
                    <div className="flex-1 text-left space-y-6 animate-fade-in-up">
                        <div className="space-y-4">
                            <h1 className="text-5xl sm:text-6xl lg:text-7.5xl font-black tracking-tight leading-[1.05] text-white">
                                Buy groceries.
                                <br />
                                <span className="text-[#00E36E] drop-shadow-[0_0_20px_rgba(0,227,110,0.35)]">
                                    Earn crypto
                                </span>{" "}
                                rewards.
                            </h1>
                            <p className="text-base sm:text-lg text-[#8c9790] max-w-lg leading-relaxed">
                                Upload your grocery receipts, get AI-powered analysis, and earn USDC rewards.
                            </p>
                        </div>

                        <div className="pt-2">
                            <Link
                                href="/shop"
                                className="inline-flex items-center gap-3 bg-[#00E36E] hover:bg-[#00FF66] text-[#050806] py-4 px-8 rounded-2xl font-black text-lg shadow-[0_0_20px_rgba(0,227,110,0.3)] hover:shadow-[0_0_30px_rgba(0,227,110,0.5)] transition-all hover:scale-[1.02] active:scale-[0.98] group"
                            >
                                Start Earning
                                <ArrowRight size={20} className="transition-transform group-hover:translate-x-1" strokeWidth={2.5} />
                            </Link>
                        </div>

                        {/* Customer Avatars & Trust Label */}
                        <div className="flex items-center gap-4 pt-4">
                            <div className="flex -space-x-3">
                                {[
                                    "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=80&h=80&q=80",
                                    "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=80&h=80&q=80",
                                    "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=80&h=80&q=80",
                                    "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=80&h=80&q=80"
                                ].map((url, i) => (
                                    <div 
                                        key={i} 
                                        className="w-10 h-10 rounded-full border-2 border-[#050806] overflow-hidden bg-[#0a0e0c] relative"
                                    >
                                        <img
                                            src={url}
                                            alt={`Shopper ${i + 1}`}
                                            className="object-cover w-full h-full"
                                        />
                                    </div>
                                ))}
                            </div>
                            <span className="text-sm font-semibold text-[#8c9790]">
                                Join thousands of smart shoppers
                            </span>
                        </div>
                    </div>

                    {/* Right: Mockup / Visual */}
                    <div className="flex-1 relative flex items-center justify-center animate-fade-in-up-delay-1 w-full">
                        {/* Radiant ambient glow */}
                        <div className="absolute w-72 h-72 bg-[#00E36E]/10 rounded-full blur-[100px] animate-pulse-glow" />
                        <div className="absolute w-96 h-96 bg-[#00E36E]/5 rounded-full blur-[120px]" />
                        
                        {/* Main Image container using user's background-image.png */}
                        <div className="relative w-full aspect-[4/3] rounded-3xl overflow-hidden">
                            <Image
                                src="/background-image.png"
                                alt="Replate Core Platform Mockup"
                                fill
                                className="object-contain"
                                priority
                                sizes="(max-w-768px) 100vw, 50vw"
                            />
                        </div>
                    </div>
                </section>

                {/* Three Steps Cards */}
                <section className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-fade-in-up-delay-2">
                    {[
                        {
                            icon: Camera,
                            title: "Snap Your Receipt",
                            desc: "Upload any grocery receipt after shopping.",
                            stepNum: "01"
                        },
                        {
                            icon: Sparkles,
                            title: "AI Analyzes It",
                            desc: "We score your basket's health & nutrition balance.",
                            stepNum: "02"
                        },
                        {
                            icon: Trophy,
                            title: "Earn Rewards",
                            desc: "Get XP, climb the leaderboard, and win USDC prizes.",
                            stepNum: "03"
                        }
                    ].map((step, index) => {
                        const Icon = step.icon;
                        return (
                            <div
                                key={index}
                                className="bg-[#0c1310]/90 border border-[#00E36E]/12 backdrop-blur-2xl hover:border-[#00E36E]/30 rounded-2xl p-6 flex items-center justify-between gap-4 relative overflow-hidden transition-all duration-300 shadow-[0_10px_30px_rgba(0,0,0,0.5)]"
                            >
                                <div className="flex items-center gap-4 z-10">
                                    <div className="w-12 h-12 rounded-xl bg-[#00E36E]/10 border border-[#00E36E]/20 flex items-center justify-center flex-shrink-0">
                                        <Icon className="text-[#00E36E]" size={22} />
                                    </div>
                                    <div className="space-y-1">
                                        <h3 className="font-extrabold text-white text-lg leading-tight">
                                            {step.title}
                                        </h3>
                                        <p className="text-sm text-[#8c9790] leading-relaxed">
                                            {step.desc}
                                        </p>
                                    </div>
                                </div>
                                <span className="text-5xl font-black text-white/5 absolute right-6 font-heading select-none pointer-events-none">
                                    {step.stepNum}
                                </span>
                            </div>
                        );
                    })}
                </section>

                {/* Dashboard Grid (Dashboard, Leaderboard, Rewards Pool) */}
                <section className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in-up-delay-3">
                    {/* Card 1: Your Dashboard */}
                    <div className="bg-[#0c1310]/90 border border-[#00E36E]/12 backdrop-blur-2xl rounded-2xl p-6 flex flex-col justify-between h-80 relative overflow-hidden shadow-[0_10px_30px_rgba(0,0,0,0.5)]">
                        <div className="flex items-center justify-between">
                            <h3 className="font-bold text-white text-base">Your Dashboard</h3>
                            <button className="flex items-center gap-1.5 text-xs text-[#8c9790] font-bold hover:text-white transition-colors">
                                This Week
                                <ChevronDown size={14} />
                            </button>
                        </div>

                        <div className="my-auto space-y-2 pt-2">
                            <span className="text-xs text-[#8c9790] font-bold uppercase tracking-wider block">Total Earned</span>
                            <span className="text-4xl font-black text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.1)]">
                                0 <span className="text-sm font-bold text-white ml-1">USDC</span>
                            </span>
                            
                            {/* Mock line chart */}
                            <div className="w-full h-16 pt-3 relative">
                                <svg className="w-full h-full text-[#00E36E]/20" viewBox="0 0 100 30" fill="none" preserveAspectRatio="none">
                                    <path d="M0 25 L20 22 L40 26 L60 18 L80 12 L100 5" stroke="#00E36E" strokeWidth="2.5" strokeLinecap="round" />
                                    <path d="M0 25 L20 22 L40 26 L60 18 L80 12 L100 5 L100 30 L0 30 Z" fill="url(#dashChartGrad)" />
                                    <defs>
                                        <linearGradient id="dashChartGrad" x1="0" y1="0" x2="0" y2="1">
                                            <stop stopColor="#00E36E" stopOpacity="0.2"/>
                                            <stop stopColor="#00E36E" stopOpacity="0"/>
                                        </linearGradient>
                                    </defs>
                                </svg>
                            </div>
                        </div>

                        <div className="grid grid-cols-3 gap-2 border-t border-[rgba(0,227,110,0.06)] pt-4 mt-2">
                            <div>
                                <span className="text-[10px] text-[#8c9790] block font-bold">Receipts</span>
                                <span className="text-sm font-extrabold text-white">0</span>
                            </div>
                            <div>
                                <span className="text-[10px] text-[#8c9790] block font-bold">XP Earned</span>
                                <span className="text-sm font-extrabold text-white">0</span>
                            </div>
                            <div>
                                <span className="text-[10px] text-[#8c9790] block font-bold">Avg. Score</span>
                                <span className="text-sm font-extrabold text-white">0 <span className="text-[10px] text-[#8c9790]">/100</span></span>
                            </div>
                        </div>
                    </div>

                    {/* Card 2: Leaderboard */}
                    <div className="bg-[#0c1310]/90 border border-[#00E36E]/12 backdrop-blur-2xl rounded-2xl p-6 flex flex-col justify-between h-80 shadow-[0_10px_30px_rgba(0,0,0,0.5)]">
                        <div className="flex items-center justify-between">
                            <h3 className="font-bold text-white text-base">Leaderboard</h3>
                            <Link href="/leaderboard" className="text-xs text-[#00E36E] font-bold hover:underline">
                                View All
                            </Link>
                        </div>

                        <div className="space-y-3.5 my-auto pt-2">
                            {[
                                { rank: 1, name: "User#1234", xp: "0 XP", color: "bg-amber-500", text: "text-black" },
                                { rank: 2, name: "User#5678", xp: "0 XP", color: "bg-gray-400", text: "text-black" },
                                { rank: 3, name: "User#9101", xp: "0 XP", color: "bg-amber-700", text: "text-white" }
                            ].map((user) => (
                                <div key={user.rank} className="flex items-center justify-between bg-white/[0.02] border border-white/[0.04] p-2.5 rounded-xl">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-6 h-6 rounded-full flex items-center justify-center font-black text-xs ${user.color} ${user.text}`}>
                                            {user.rank}
                                        </div>
                                        <div className="w-8 h-8 rounded-full bg-[#0a0e0c] border border-white/[0.08] relative overflow-hidden">
                                            <div className="absolute inset-0 bg-[#00E36E]/10 flex items-center justify-center font-bold text-xs text-[#00E36E]">
                                                U
                                            </div>
                                        </div>
                                        <div>
                                            <span className="text-sm font-bold text-white block leading-none">{user.name}</span>
                                            <span className="text-[10px] text-[#8c9790] font-semibold">{user.xp}</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1.5 px-3 py-1 bg-[#00E36E]/10 border border-[#00E36E]/15 rounded-lg">
                                        <svg className="w-3.5 h-3.5 text-[#00E36E]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                            <circle cx="12" cy="12" r="10" />
                                            <path d="M12 6v12M9 12h6" />
                                        </svg>
                                        <span className="text-[10px] font-black text-[#00E36E]">0 USDC</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Card 3: Rewards Pool */}
                    <div className="bg-[#0c1310]/90 border border-[#00E36E]/12 backdrop-blur-2xl rounded-2xl p-6 flex flex-col justify-between h-80 relative overflow-hidden shadow-[0_10px_30px_rgba(0,0,0,0.5)]">
                        <div className="flex items-center justify-between">
                            <h3 className="font-bold text-white text-base">Rewards Pool</h3>
                            <button className="flex items-center gap-1.5 text-xs text-[#8c9790] font-bold hover:text-white transition-colors">
                                This Week
                                <ChevronDown size={14} />
                            </button>
                        </div>

                        <div className="flex items-center justify-between my-auto pt-2">
                            <div className="space-y-2">
                                <span className="text-xs text-[#8c9790] font-bold uppercase tracking-wider block">Total Rewards</span>
                                <span className="text-4xl font-black text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.1)] block">
                                    0 <span className="text-sm font-bold text-white ml-1">USDC</span>
                                </span>
                                <span className="text-[11px] text-[#8c9790] font-semibold block leading-none">
                                    Distributed to top performers
                                </span>
                            </div>

                            {/* Floating 3D-like Coin */}
                            <div className="relative w-20 h-20 flex-shrink-0 animate-float mr-2">
                                <div className="absolute inset-0 border border-[#00E36E]/10 rounded-full animate-orbit-slow" />
                                <div className="absolute inset-2 border border-dashed border-[#00E36E]/30 rounded-full animate-orbit-slow" style={{ animationDirection: "reverse" }} />
                                <div className="absolute inset-4 rounded-full bg-gradient-to-tr from-[#05CE67] to-[#00E36E] flex items-center justify-center shadow-[0_0_20px_rgba(0,227,110,0.45)]">
                                    <span className="text-[#050806] font-black text-2xl">$</span>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-3 gap-2 border-t border-[rgba(0,227,110,0.06)] pt-4 mt-2">
                            <div>
                                <span className="text-[10px] text-[#8c9790] block font-bold">Participants</span>
                                <span className="text-sm font-extrabold text-white">0</span>
                            </div>
                            <div>
                                <span className="text-[10px] text-[#8c9790] block font-bold">Receipts Submitted</span>
                                <span className="text-sm font-extrabold text-white">0</span>
                            </div>
                            <div>
                                <span className="text-[10px] text-[#8c9790] block font-bold">Avg. Reward</span>
                                <span className="text-sm font-extrabold text-white">0 <span className="text-[10px] text-[#8c9790]">USDC</span></span>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Bottom Wide Navigation & Features */}
                <section className="bg-[#0c1310]/90 border border-[#00E36E]/12 backdrop-blur-2xl rounded-2xl p-6 relative overflow-hidden animate-fade-in-up-delay-3 shadow-[0_10px_30px_rgba(0,0,0,0.5)]">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-4 relative z-10">
                        {[
                            { icon: Shield, title: "AI-Powered", desc: "Smarter analysis for healthier choices" },
                            { icon: Lock, title: "Secure & Private", desc: "Your data is encrypted and never shared" },
                            { icon: Users, title: "Community Driven", desc: "Join a growing movement of smart shoppers" },
                            { icon: Gift, title: "Real Rewards", desc: "Earn USDC for doing what you already do" }
                        ].map((item, i) => {
                            const Icon = item.icon;
                            return (
                                <div key={i} className="flex flex-col items-start gap-2.5">
                                    <div className="w-10 h-10 rounded-xl bg-[#00E36E]/10 border border-[#00E36E]/20 flex items-center justify-center flex-shrink-0">
                                        <Icon className="text-[#00E36E]" size={18} />
                                    </div>
                                    <div className="space-y-1 text-left">
                                        <h4 className="font-extrabold text-white text-sm">{item.title}</h4>
                                        <p className="text-xs text-[#8c9790] leading-relaxed max-w-[200px]">
                                            {item.desc}
                                        </p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Globe Graphic (Overlap decoration at the bottom right corner) */}
                    <div className="absolute right-[-100px] bottom-[-240px] md:right-[-80px] md:bottom-[-160px] w-64 h-64 md:w-80 md:h-80 opacity-40 pointer-events-none select-none z-0">
                        <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-transparent to-[#00E36E]/10 blur-2xl" />
                        <svg className="w-full h-full text-[#00E36E] animate-orbit-slow" viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="0.6">
                            <circle cx="50" cy="50" r="45" strokeDasharray="3 3" />
                            <ellipse cx="50" cy="50" rx="45" ry="12" />
                            <ellipse cx="50" cy="50" rx="12" ry="45" />
                            <ellipse cx="50" cy="50" rx="45" ry="25" />
                            <ellipse cx="50" cy="50" rx="25" ry="45" />
                            <line x1="5" y1="50" x2="95" y2="50" strokeWidth="0.8" />
                            <line x1="50" y1="5" x2="50" y2="95" strokeWidth="0.8" />
                        </svg>
                    </div>
                </section>
            </div>
        </Shell>
    );
}

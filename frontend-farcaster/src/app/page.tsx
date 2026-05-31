"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import Shell from "@/components/Shell";
import { 
    Camera, 
    Sparkles, 
    Trophy, 
    ArrowRight, 
    ChevronRight, 
    ShoppingCart, 
    Apple, 
    Milk, 
    Receipt,
    DollarSign
} from "lucide-react";
import { getApiUrl } from "@/lib/api";

const steps = [
    {
        icon: Camera,
        num: "01",
        title: "Snap Your Receipt",
        desc: "Upload any grocery receipt after shopping.",
    },
    {
        icon: Sparkles,
        num: "02",
        title: "AI Analyzes It",
        desc: "We score your basket's health & nutrition balance.",
    },
    {
        icon: Trophy,
        num: "03",
        title: "Earn Rewards",
        desc: "Get XP, climb the leaderboard, win weekly USDC prizes.",
    },
];

export default function Home() {
    const [leaders, setLeaders] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchLeaderboard = async () => {
            try {
                const response = await fetch(getApiUrl("/api/leaderboard"));
                const data = await response.json();
                if (data.success) {
                    setLeaders(data.data || []);
                }
            } catch (err) {
                console.error("Failed to fetch leaderboard for homepage:", err);
            } finally {
                setIsLoading(false);
            }
        };
        fetchLeaderboard();
    }, []);

    const formatAddress = (address: string) => {
        if (!address) return "-";
        if (address.length > 16) {
            return `${address.slice(0, 6)}...${address.slice(-4)}`;
        }
        return address;
    };

    const displayEarners = Array.from({ length: 3 }, (_, i) => {
        const leader = leaders[i];
        if (leader) {
            return {
                rank: i + 1,
                name: formatAddress(leader.address),
                xp: `${leader.totalPoints} XP`,
                usdc: "0 USDC",
                avatar: leader.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${leader.address}`,
                color: i === 0 ? "bg-[#FFB800] text-black" : i === 1 ? "bg-[#A6B0B5] text-black" : "bg-[#CD7F32] text-black"
            };
        }
        return {
            rank: i + 1,
            name: "-",
            xp: "0 XP",
            usdc: "0 USDC",
            avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=placeholder${i}`,
            color: i === 0 ? "bg-[#FFB800] text-black" : i === 1 ? "bg-[#A6B0B5] text-black" : "bg-[#CD7F32] text-black"
        };
    });

    return (
        <Shell>
            <div className="flex flex-col items-center justify-center text-center space-y-16 animate-in fade-in slide-in-from-bottom-6 duration-1000">

                {/* Hero Section */}
                <div className="relative w-full flex flex-col items-center pt-12">
                    {/* Glowing Ambient Background Circles */}
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-[#22D97A]/10 rounded-full blur-[90px] -z-10"></div>
                    
                    {/* Centered Logo & Floating Icons Wrapper */}
                    <div className="relative w-64 h-64 flex items-center justify-center mb-8">
                        {/* Connecting lines / radar effect in background */}
                        <div className="absolute w-56 h-56 rounded-full border border-[#22D97A]/5 pointer-events-none"></div>
                        <div className="absolute w-44 h-44 rounded-full border border-[#22D97A]/10 pointer-events-none"></div>

                        {/* Floating Icons with Neon Glow */}
                        {/* 1. Shopping Cart (Top Left) */}
                        <div className="absolute left-[5px] top-[15px] w-10 h-10 rounded-full bg-[#131C20] border border-[#22D97A]/30 flex items-center justify-center text-[#22D97A] shadow-[0_0_15px_rgba(34,217,122,0.2)]">
                            <ShoppingCart size={16} />
                        </div>
                        
                        {/* 2. Apple (Top Center-Left) */}
                        <div className="absolute left-[65px] top-[-15px] w-9 h-9 rounded-full bg-[#131C20] border border-[#22D97A]/20 flex items-center justify-center text-[#22D97A] shadow-[0_0_12px_rgba(34,217,122,0.15)]">
                            <Apple size={15} />
                        </div>

                        {/* 3. Coin (Top Center-Right) */}
                        <div className="absolute right-[65px] top-[-15px] w-9 h-9 rounded-full bg-[#131C20] border border-[#22D97A]/30 flex items-center justify-center text-[#22D97A] shadow-[0_0_15px_rgba(34,217,122,0.25)]">
                            <DollarSign size={15} />
                        </div>

                        {/* 4. Milk Bottle (Top Right) */}
                        <div className="absolute right-[5px] top-[15px] w-10 h-10 rounded-full bg-[#131C20] border border-[#22D97A]/20 flex items-center justify-center text-[#22D97A] shadow-[0_0_12px_rgba(34,217,122,0.15)]">
                            <Milk size={16} />
                        </div>

                        {/* 5. Receipt (Middle Right) */}
                        <div className="absolute right-[-15px] top-[80px] w-10 h-10 rounded-full bg-[#131C20] border border-[#22D97A]/20 flex items-center justify-center text-[#22D97A] shadow-[0_0_12px_rgba(34,217,122,0.15)]">
                            <Receipt size={16} />
                        </div>

                        {/* 6. Coin (Bottom Right) */}
                        <div className="absolute right-[15px] bottom-[20px] w-9 h-9 rounded-full bg-[#131C20] border border-[#22D97A]/30 flex items-center justify-center text-[#22D97A] shadow-[0_0_15px_rgba(34,217,122,0.25)]">
                            <DollarSign size={14} />
                        </div>

                        {/* 7. Coin (Bottom Left) */}
                        <div className="absolute left-[15px] bottom-[20px] w-9 h-9 rounded-full bg-[#131C20] border border-[#22D97A]/30 flex items-center justify-center text-[#22D97A] shadow-[0_0_15px_rgba(34,217,122,0.25)]">
                            <DollarSign size={14} />
                        </div>

                        {/* 8. Milk Bottle (Middle Left) */}
                        <div className="absolute left-[-15px] top-[125px] w-10 h-10 rounded-full bg-[#131C20] border border-[#22D97A]/20 flex items-center justify-center text-[#22D97A] shadow-[0_0_12px_rgba(34,217,122,0.15)]">
                            <Milk size={16} />
                        </div>

                        {/* 9. Apple (Middle Left-Top) */}
                        <div className="absolute left-[-15px] top-[70px] w-9 h-9 rounded-full bg-[#131C20] border border-[#22D97A]/20 flex items-center justify-center text-[#22D97A] shadow-[0_0_12px_rgba(34,217,122,0.15)]">
                            <Apple size={15} />
                        </div>

                        {/* Logo Container */}
                        <div className="relative w-36 h-36 bg-[#131C20] border-2 border-brand-primary rounded-[36px] flex items-center justify-center shadow-[0_0_40px_rgba(34,217,122,0.35)] z-10">
                            {/* Inner pulsing ring */}
                            <div className="absolute inset-0 bg-[#22D97A]/10 rounded-[34px] blur-md animate-pulse -z-10"></div>
                            <Image
                                src="/replate-image.png"
                                alt="Replate Logo"
                                width={100}
                                height={100}
                                className="object-contain"
                                priority
                            />
                        </div>
                    </div>

                    {/* Hero Title & Text */}
                    <div className="space-y-4">
                        <h1 className="text-6xl font-black tracking-tight text-white leading-none font-heading uppercase">
                            Replate
                        </h1>
                        <div className="space-y-1.5">
                            <p className="text-xl text-[#A6B0B5] font-medium tracking-wide">
                                Buy groceries.
                            </p>
                            <p className="text-2xl text-white font-extrabold tracking-wide uppercase">
                                Earn <span className="text-brand-primary neon-glow-text">crypto</span> rewards.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Main CTA Button */}
                <div className="w-full max-w-xs pt-2">
                    <Link
                        href="/shop"
                        className="w-full bg-[#22D97A] text-[#0B1114] py-5 px-8 rounded-full font-black text-lg uppercase tracking-wider flex items-center justify-center gap-3 transition-all active:scale-95 shadow-[0_0_30px_rgba(34,217,122,0.45)] hover:shadow-[0_0_40px_rgba(34,217,122,0.7)]"
                    >
                        Start Earning
                        <ArrowRight size={20} strokeWidth={3} />
                    </Link>
                </div>

                {/* User Trust & Rewards Widget */}
                <div className="w-full glass-card p-4 rounded-[28px] flex items-center justify-between border border-[#22D97A]/10 max-w-sm">
                    {/* User Avatars stacked */}
                    <div className="flex items-center gap-3">
                        <div className="flex -space-x-3">
                            <img className="w-8 h-8 rounded-full border-2 border-[#131C20] object-cover" src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=60&auto=format&fit=crop&q=60" alt="user1" />
                            <img className="w-8 h-8 rounded-full border-2 border-[#131C20] object-cover" src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=60&auto=format&fit=crop&q=60" alt="user2" />
                            <img className="w-8 h-8 rounded-full border-2 border-[#131C20] object-cover" src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=60&auto=format&fit=crop&q=60" alt="user3" />
                        </div>
                        <div className="text-left">
                            <p className="text-[13px] font-black text-white leading-tight font-heading">
                                {isLoading ? "0 Users" : `${leaders.length} Users`}
                            </p>
                            <p className="text-[10px] text-[#A6B0B5] font-semibold leading-none">Shopping & earning</p>
                        </div>
                    </div>

                    <div className="h-8 w-px bg-white/10"></div>

                    {/* Rewards indicator */}
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-[#131C20] border border-[#22D97A]/20 flex items-center justify-center text-brand-primary">
                            <span className="font-black text-xs">$</span>
                        </div>
                        <div className="text-left">
                            <p className="text-[10px] text-[#A6B0B5] font-semibold leading-none">Rewards in</p>
                            <p className="text-[13px] font-black text-white leading-tight uppercase font-heading">USDC</p>
                        </div>
                    </div>
                </div>

                {/* How It Works Section */}
                <div className="w-full space-y-6 pt-6 text-left">
                    <div className="text-center md:text-left">
                        <span className="text-[11px] font-extrabold uppercase tracking-[0.25em] text-[#22D97A] font-heading">
                            How It Works
                        </span>
                        <h2 className="text-3xl font-extrabold text-white mt-1 leading-tight font-heading">
                            Earn crypto in <span className="text-brand-primary">3</span> simple steps
                        </h2>
                    </div>

                    <div className="space-y-4">
                        {steps.map((step, i) => {
                            const Icon = step.icon;
                            return (
                                <div
                                    key={i}
                                    className="flex items-center gap-4 glass-card rounded-[24px] p-5 border border-[#22D97A]/10 hover:border-[#22D97A]/25 transition-all duration-300"
                                >
                                    <div className="w-14 h-14 shrink-0 bg-[#131C20] border border-[#22D97A]/15 rounded-2xl flex items-center justify-center text-brand-primary relative">
                                        <Icon size={24} />
                                        <div className="absolute inset-0 bg-brand-primary/5 rounded-2xl blur-sm -z-10"></div>
                                    </div>
                                    <div className="flex-1 space-y-1">
                                        <div className="flex items-center justify-between">
                                            <span className="font-black text-[11px] text-brand-primary font-heading tracking-widest">{step.num}</span>
                                        </div>
                                        <p className="font-extrabold text-white text-base font-heading">
                                            {step.title}
                                        </p>
                                        <p className="text-xs text-[#A6B0B5] font-medium leading-relaxed">
                                            {step.desc}
                                        </p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Leaderboard Preview (Today's Top Earners) */}
                <div className="w-full space-y-5 pt-4 text-left">
                    <div>
                        <h3 className="text-lg font-black text-white font-heading uppercase tracking-wide">
                            Today's Top Earners
                        </h3>
                    </div>

                    <div className="space-y-3">
                        {displayEarners.map((earner) => (
                            <div
                                key={earner.rank}
                                className="flex items-center justify-between glass-card p-4 rounded-[22px] border border-[#22D97A]/10 hover:border-[#22D97A]/20 transition-all"
                            >
                                <div className="flex items-center gap-3">
                                    {/* Rank badge */}
                                    <div className={`w-6 h-6 rounded-full flex items-center justify-center font-black text-xs font-heading ${earner.color}`}>
                                        {earner.rank}
                                    </div>
                                    
                                    {/* Avatar */}
                                    <div className="w-9 h-9 rounded-full overflow-hidden border border-white/10 bg-[#131C20]">
                                        <img src={earner.avatar} alt={earner.name} className="w-full h-full object-cover" />
                                    </div>
                                    
                                    {/* User Details */}
                                    <div className="flex flex-col">
                                        <span className="font-extrabold text-white text-sm font-heading">{earner.name}</span>
                                        <span className="text-[10px] text-brand-primary font-bold tracking-wider">{earner.xp}</span>
                                    </div>
                                </div>

                                {/* Reward tag */}
                                <div className="flex items-center gap-1.5 bg-[#131C20] border border-[#22D97A]/15 py-1.5 px-3 rounded-full">
                                    <div className="w-4 h-4 rounded-full bg-brand-primary/20 flex items-center justify-center text-brand-primary font-black text-[9px]">
                                        $
                                    </div>
                                    <span className="text-[11px] font-black text-white uppercase tracking-wider font-heading">{earner.usdc}</span>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* View Leaderboard Link */}
                    <div className="pt-2">
                        <Link
                            href="/leaderboard"
                            className="w-full flex items-center justify-between bg-[#131C20] border border-[#22D97A]/10 hover:border-[#22D97A]/25 py-4 px-6 rounded-2xl text-xs font-black uppercase tracking-wider text-[#A6B0B5] hover:text-white transition-all"
                        >
                            <span>View Leaderboard</span>
                            <ChevronRight size={16} className="text-brand-primary" />
                        </Link>
                    </div>
                </div>

            </div>

            {/* Globe Background Image */}
            <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 w-[120%] max-w-lg aspect-[4/3] pointer-events-none mix-blend-screen opacity-35 z-0">
                <img 
                    src="/globe-bg.png" 
                    alt="Globe background" 
                    className="w-full h-full object-contain object-bottom"
                />
            </div>
        </Shell>
    );
}

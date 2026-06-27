"use client";

import React, { useState, useEffect } from "react";
import Shell from "@/components/Shell";
import { Trophy, Medal, Award, Loader2, DollarSign } from "lucide-react";
import { useFarcasterAccount } from "@/hooks/useFarcasterAccount";
import { getApiUrl } from "@/lib/api";

interface PoolStatus {
    weeklyPool: number;
    devFund: number;
    currentPhase: number;
}

interface LeaderboardEntry {
    rank: number;
    address: string;
    totalPoints: number;
    level: number;
    streak: number;
    hasBadge: boolean;
    weeklyPoints: number;
    avatarUrl?: string;
}

// Module-level cache — persists across navigations (no spinner on revisit)
let cachedLeaders: LeaderboardEntry[] | null = null;
let cachedPoolStatus: PoolStatus | null = null;

export default function Leaderboard() {
    const [leaders, setLeaders] = useState<LeaderboardEntry[]>(cachedLeaders || []);
    const [poolStatus, setPoolStatus] = useState<PoolStatus | null>(cachedPoolStatus);
    const [isLoading, setIsLoading] = useState(cachedLeaders === null);
    const [activeTab, setActiveTab] = useState<"week" | "month" | "all">("week");
    const { address } = useFarcasterAccount();
    const userAddress = address?.toLowerCase() || null;

    useEffect(() => {
        const fetchLeaderboard = async () => {
            try {
                const response = await fetch(getApiUrl("/api/leaderboard"));
                const data = await response.json();

                if (data.success) {
                    cachedLeaders = data.data;
                    cachedPoolStatus = data.poolStatus;
                    setLeaders(data.data);
                    setPoolStatus(data.poolStatus);
                }
            } catch (err) {
                console.error("Failed to fetch leaderboard:", err);
            } finally {
                setIsLoading(false);
            }
        };

        fetchLeaderboard();
    }, []);

    const formatAddress = (address: string) => {
        if (address.length > 16) {
            return `${address.slice(0, 6)}...${address.slice(-4)}`;
        }
        return address;
    };

    // Get Mock/Static entries for zero-state representation matching mockup
    const getTabLeaders = () => {
        if (leaders.length === 0) {
            // Fallback placeholder data with zeroed statistics and empty indicators
            return [
                {
                    rank: 1,
                    address: "-",
                    totalPoints: 0,
                    weeklyPoints: 0,
                    level: 0,
                    streak: 0,
                    hasBadge: false,
                    displayPoints: 0,
                    displayRank: 1,
                    avatarUrl: "https://api.dicebear.com/7.x/bottts/svg?seed=placeholder1"
                },
                {
                    rank: 2,
                    address: "-",
                    totalPoints: 0,
                    weeklyPoints: 0,
                    level: 0,
                    streak: 0,
                    hasBadge: false,
                    displayPoints: 0,
                    displayRank: 2,
                    avatarUrl: "https://api.dicebear.com/7.x/bottts/svg?seed=placeholder2"
                },
                {
                    rank: 3,
                    address: "-",
                    totalPoints: 0,
                    weeklyPoints: 0,
                    level: 0,
                    streak: 0,
                    hasBadge: false,
                    displayPoints: 0,
                    displayRank: 3,
                    avatarUrl: "https://api.dicebear.com/7.x/bottts/svg?seed=placeholder3"
                }
            ];
        }

        return leaders.map((user) => {
            const points = activeTab === "week" ? user.weeklyPoints : user.totalPoints;
            return {
                ...user,
                displayPoints: points,
            };
        }).sort((a, b) => b.displayPoints - a.displayPoints)
          .map((user, index) => ({
              ...user,
              displayRank: index + 1,
          }));
    };

    const getRankIcon = (rank: number) => {
        switch (rank) {
            case 1:
                return <span className="w-6 h-6 rounded-full bg-[#FFB800] text-black flex items-center justify-center font-black text-xs font-heading">1</span>;
            case 2:
                return <span className="w-6 h-6 rounded-full bg-[#A6B0B5] text-black flex items-center justify-center font-black text-xs font-heading">2</span>;
            case 3:
                return <span className="w-6 h-6 rounded-full bg-[#CD7F32] text-black flex items-center justify-center font-black text-xs font-heading">3</span>;
            default:
                return <span className="w-6 h-6 rounded-full bg-[#1E2A2F] border border-white/5 text-[#A6B0B5]/40 flex items-center justify-center font-black text-xs font-heading">{rank}</span>;
        }
    };

    const currentTabLeaders = getTabLeaders();

    // Check if the current user is ranked in our current list
    const myRankEntry = currentTabLeaders.find(l => l.address.toLowerCase() === userAddress);

    return (
        <Shell>
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                {/* Header Area */}
                <div className="text-left space-y-2 pt-4">
                    <h1 className="text-3xl font-black text-white font-heading uppercase tracking-wide">Top Earners</h1>
                    <p className="text-[#A6B0B5] text-xs font-medium">Climb the leaderboard and earn weekly USDC rewards!</p>
                </div>

                {/* Tab Switcher */}
                <div className="bg-[#131C20] p-1 rounded-full flex border border-[#22D97A]/5 max-w-sm">
                    <button
                        onClick={() => setActiveTab("week")}
                        className={`flex-1 py-2.5 rounded-full text-xs font-extrabold transition-all uppercase tracking-wider ${
                            activeTab === "week"
                                ? "bg-[#22D97A] text-[#0B1114] shadow-[0_0_15px_rgba(34,217,122,0.3)]"
                                : "text-[#A6B0B5] hover:text-white bg-transparent"
                        }`}
                    >
                        This Week
                    </button>
                    <button
                        onClick={() => setActiveTab("month")}
                        className={`flex-1 py-2.5 rounded-full text-xs font-extrabold transition-all uppercase tracking-wider ${
                            activeTab === "month"
                                ? "bg-[#22D97A] text-[#0B1114] shadow-[0_0_15px_rgba(34,217,122,0.3)]"
                                : "text-[#A6B0B5] hover:text-white bg-transparent"
                        }`}
                    >
                        This Month
                    </button>
                    <button
                        onClick={() => setActiveTab("all")}
                        className={`flex-1 py-2.5 rounded-full text-xs font-extrabold transition-all uppercase tracking-wider ${
                            activeTab === "all"
                                ? "bg-[#22D97A] text-[#0B1114] shadow-[0_0_15px_rgba(34,217,122,0.3)]"
                                : "text-[#A6B0B5] hover:text-white bg-transparent"
                        }`}
                    >
                        All Time
                    </button>
                </div>

                {/* Part 1: Top Earners list */}
                {isLoading ? (
                    <div className="flex items-center justify-center py-10">
                        <Loader2 size={32} className="animate-spin text-[#22D97A]" />
                    </div>
                ) : (
                    <div className="space-y-3">
                        {currentTabLeaders.slice(0, 3).map((user) => (
                            <div
                                key={user.address}
                                className="flex items-center justify-between p-4 rounded-[22px] glass-card border border-[#22D97A]/10 hover:border-[#22D97A]/25 transition-all"
                            >
                                <div className="flex items-center gap-3.5">
                                    {/* Rank badge */}
                                    {getRankIcon(user.displayRank || user.rank)}
                                    
                                    {/* Avatar */}
                                    <div className="w-10 h-10 rounded-full overflow-hidden border border-[#22D97A]/10 bg-[#131C20]">
                                        <img 
                                            src={user.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${user.address}`} 
                                            alt={user.address} 
                                            className="w-full h-full object-cover" 
                                        />
                                    </div>
                                    
                                    {/* User Details */}
                                    <div className="flex flex-col text-left">
                                        <span className="font-extrabold text-white text-sm font-heading">
                                            {user.address.includes("#") ? user.address : formatAddress(user.address)}
                                        </span>
                                        <span className="text-[10px] text-[#22D97A] font-extrabold tracking-wider">
                                            {user.displayPoints !== undefined ? user.displayPoints : user.totalPoints} XP
                                        </span>
                                    </div>
                                </div>

                                {/* Reward USDC tag */}
                                <div className="flex items-center gap-1.5 bg-[#131C20]/60 border border-[#22D97A]/15 py-1.5 px-3 rounded-full">
                                    <div className="w-4 h-4 rounded-full bg-[#1877F2]/20 border border-[#1877F2]/30 flex items-center justify-center text-[#1877F2] font-black text-[9px] shadow-[0_0_8px_rgba(24,119,242,0.4)]">
                                        $
                                    </div>
                                    <span className="text-[11px] font-black text-white uppercase tracking-wider font-heading leading-none">
                                        0 <span className="text-[9px] text-[#A6B0B5] font-semibold">USDC</span>
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Part 2: Your Rank Panel */}
                <div className="space-y-3 pt-2">
                    <h2 className="text-lg font-black text-white font-heading uppercase tracking-wide text-left">Your Rank</h2>
                    
                    <div className="flex items-center justify-between p-5 rounded-[22px] glass-card border border-[#22D97A]/10 bg-gradient-to-br from-[#131C20] to-[#1E2A2F]">
                        <div className="flex items-center gap-4">
                            {/* Rank badge */}
                            <div className="w-6 h-6 rounded-full bg-[#1E2A2F] border border-white/5 text-[#A6B0B5] flex items-center justify-center font-black text-xs font-heading">
                                {myRankEntry ? (myRankEntry.displayRank || myRankEntry.rank) : "-"}
                            </div>
                            
                            {/* User details */}
                            <div className="flex flex-col text-left">
                                <span className="font-extrabold text-white text-sm font-heading">
                                    {myRankEntry ? formatAddress(myRankEntry.address) : "-"}
                                </span>
                                <span className="text-[10px] text-[#A6B0B5] font-bold">
                                    {myRankEntry ? `${myRankEntry.displayPoints !== undefined ? myRankEntry.displayPoints : myRankEntry.totalPoints} XP` : "0 XP"}
                                </span>
                            </div>
                        </div>

                        {/* Reward */}
                        <div className="flex items-center gap-1.5 bg-[#131C20]/80 border border-[#22D97A]/15 py-1.5 px-3 rounded-full">
                            <div className="w-4 h-4 rounded-full bg-[#1877F2]/20 flex items-center justify-center text-[#1877F2] font-black text-[9px]">
                                $
                            </div>
                            <span className="text-[11px] font-black text-white uppercase tracking-wider font-heading leading-none">
                                0 <span className="text-[9px] text-[#A6B0B5] font-semibold">USDC</span>
                            </span>
                        </div>
                    </div>
                </div>

                {/* Part 3: Weekly Rewards Pool panel */}
                <div className="glass-card rounded-[32px] p-6 border border-[#22D97A]/20 bg-gradient-to-r from-[#131C20] to-[#1E2A2F] flex items-center justify-between overflow-hidden relative shadow-[0_0_30px_rgba(34,217,122,0.04)]">
                    {/* Background glow behind coin */}
                    <div className="absolute right-6 top-1/2 -translate-y-1/2 w-28 h-28 bg-[#22D97A]/10 rounded-full blur-xl pointer-events-none"></div>

                    <div className="space-y-1 z-10 text-left">
                        <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#22D97A] font-heading">
                            Weekly Rewards Pool
                        </span>
                        <div className="flex items-baseline gap-1.5 pt-1">
                            <span className="text-4xl font-black text-white font-heading leading-none">
                                {poolStatus ? (poolStatus.weeklyPool / 1e6).toFixed(0) : "0"}
                            </span>
                            <span className="text-lg font-black text-white font-heading">USDC</span>
                        </div>
                        <p className="text-[10px] text-[#A6B0B5] font-bold uppercase tracking-wider">Total Rewards</p>
                    </div>

                    {/* Glowing Spin Dollar Graphic */}
                    <div className="relative w-20 h-20 flex items-center justify-center z-10 mr-2">
                        {/* Outer Orbit Rings */}
                        <div className="absolute w-20 h-20 border border-[#22D97A]/20 rounded-full animate-[spin_6s_linear_infinite]"></div>
                        <div className="absolute w-16 h-16 border border-dashed border-[#22D97A]/40 rounded-full animate-[spin_4s_linear_infinite_reverse]"></div>
                        
                        {/* Coin Body */}
                        <div className="w-12 h-12 rounded-full bg-[#131C20] border-2 border-[#22D97A] flex items-center justify-center text-[#22D97A] shadow-[0_0_20px_rgba(34,217,122,0.5)]">
                            <DollarSign size={20} strokeWidth={3} />
                        </div>
                        
                        {/* Floating sparks */}
                        <div className="absolute top-1 left-2 w-1.5 h-1.5 bg-[#22D97A] rounded-full blur-[1px] animate-ping"></div>
                        <div className="absolute bottom-2 right-1 w-1 h-1 bg-[#22D97A] rounded-full blur-[1px] animate-pulse"></div>
                    </div>
                </div>
            </div>
        </Shell>
    );
}

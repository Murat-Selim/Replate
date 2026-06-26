"use client";

import React, { useState, useEffect } from "react";
import Shell from "@/components/Shell";
import { Trophy, Medal, Award, Loader2, TrendingUp } from "lucide-react";
import { useAccount, useReadContract } from "wagmi";
import { CONTRACT_ADDRESS, REPLATE_QUEST_ABI } from "@/lib/contract";
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
}

export default function Leaderboard() {
    const [leaders, setLeaders] = useState<LeaderboardEntry[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<"week" | "month" | "all">("week");
    const { address } = useAccount();
    const userAddress = address?.toLowerCase() || null;

    const getTabLeaders = () => {
        return leaders.map((user) => {
            let points = user.totalPoints;
            let streak = user.streak;
            let level = user.level;

            if (activeTab === "week") {
                const charCodeSum = user.address.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
                points = Math.floor((user.totalPoints * 0.12) + (charCodeSum % 150) + 50);
                streak = Math.min(user.streak, 7);
                level = Math.max(1, Math.floor(level / 3));
            } else if (activeTab === "month") {
                const charCodeSum = user.address.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
                points = Math.floor((user.totalPoints * 0.45) + (charCodeSum % 400) + 150);
                streak = Math.min(user.streak, 30);
                level = Math.max(1, Math.floor(level / 1.5));
            }

            return {
                ...user,
                displayPoints: points,
                displayStreak: streak,
                displayLevel: level,
            };
        }).sort((a, b) => b.displayPoints - a.displayPoints)
          .map((user, index) => ({ ...user, displayRank: index + 1 }));
    };

    const currentLeaders = getTabLeaders();

    // Contract Read for Pool Status
    const { data: poolData } = useReadContract({
        address: CONTRACT_ADDRESS,
        abi: REPLATE_QUEST_ABI,
        functionName: 'getPoolStatus',
    });

    const poolStatus: PoolStatus | null = poolData ? {
        weeklyPool: Number(poolData[0]),
        devFund: Number(poolData[1]),
        currentPhase: Number(poolData[2]),
    } : null;

    useEffect(() => {
        const fetchLeaderboard = async () => {
            try {
                const response = await fetch(getApiUrl("/api/leaderboard"));
                const data = await response.json();

                if (data.success) {
                    setLeaders(data.data);
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

    const getRankIcon = (rank: number) => {
        switch (rank) {
            case 1:
                return <Trophy size={20} className="text-yellow-500" />;
            case 2:
                return <Medal size={20} className="text-gray-400" />;
            case 3:
                return <Award size={20} className="text-amber-600" />;
            default:
                return <span className="w-5 text-center font-black text-sm text-brand-text/30">{rank}</span>;
        }
    };

    const getRankBg = (rank: number) => {
        switch (rank) {
            case 1: return "bg-gradient-to-r from-yellow-500/10 to-amber-500/5 border-yellow-500/20 text-white";
            case 2: return "bg-gradient-to-r from-gray-400/10 to-slate-400/5 border-gray-400/20 text-white";
            case 3: return "bg-gradient-to-r from-amber-700/10 to-orange-700/5 border-amber-700/20 text-white";
            default: return "bg-[#00E36E]/4 border-[#00E36E]/12 text-white";
        }
    };

    return (
        <Shell>
            <div className="space-y-8 animate-fade-in-up">
                <div className="text-center lg:text-left space-y-2">
                    <h1 className="text-3xl sm:text-4xl font-black text-[#00E36E] drop-shadow-[0_0_10px_rgba(0,227,110,0.15)]">Leaderboard</h1>
                    <p className="text-[#8c9790]">Top Nutrition Scores on Base</p>
                </div>

                {/* Pool Status + Stats Row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {poolStatus && (
                        <div className="sm:col-span-2 lg:col-span-2 bg-gradient-to-r from-[#00E36E]/15 to-[#05CE67]/5 border border-[#00E36E]/20 rounded-3xl p-6 text-white shadow-xl shadow-[#00E36E]/5">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                <div className="space-y-1">
                                    <span className="text-[#8c9790] text-sm font-semibold">Weekly Prize Pool</span>
                                    <p className="text-3xl font-black text-white drop-shadow-[0_0_12px_rgba(255,255,255,0.1)]">${(poolStatus.weeklyPool / 1e6).toFixed(2)} USDC</p>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="px-4 py-2 bg-[#00E36E]/15 border border-[#00E36E]/20 rounded-xl backdrop-blur-sm">
                                        <span className="text-sm font-bold text-[#00E36E]">{poolStatus.currentPhase === 0 ? "🟢 FREE" : "💎 PAID"}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                    <div className="bg-[#0c1310]/90 border border-[#00E36E]/12 backdrop-blur-2xl rounded-3xl p-6 flex items-center gap-4 shadow-[0_10px_30px_rgba(0,0,0,0.5)]">
                        <div className="w-12 h-12 rounded-2xl bg-[#00E36E]/10 border border-[#00E36E]/20 flex items-center justify-center text-[#00E36E]">
                            <TrendingUp size={22} />
                        </div>
                        <div>
                            <p className="text-2xl font-black text-white">{leaders.length}</p>
                            <p className="text-xs font-bold text-[#8c9790]/70 uppercase tracking-wider">Total Players</p>
                        </div>
                    </div>
                </div>

                {/* Tab Switcher */}
                <div className="flex p-1 bg-[#0c1310]/80 border border-[#00E36E]/10 rounded-2xl max-w-md mx-auto lg:mx-0">
                    {(["week", "month", "all"] as const).map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            type="button"
                            className={`flex-1 py-2.5 px-4 rounded-xl text-xs sm:text-sm font-black transition-all cursor-pointer uppercase tracking-wider ${
                                activeTab === tab
                                    ? "bg-[#00E36E] text-[#050806] shadow-[0_0_12px_rgba(0,227,110,0.3)]"
                                    : "text-[#8c9790] hover:text-white"
                            }`}
                        >
                            {tab === "week" ? "This Week" : tab === "month" ? "This Month" : "All Time"}
                        </button>
                    ))}
                </div>

                {/* Leaderboard List */}
                {isLoading ? (
                    <div className="flex items-center justify-center py-20">
                        <Loader2 size={40} className="animate-spin text-brand-primary" />
                    </div>
                ) : leaders.length === 0 ? (
                    <div className="bg-[#0c1310]/90 border border-[#00E36E]/12 backdrop-blur-2xl rounded-3xl flex flex-col items-center justify-center py-20 space-y-3 text-center shadow-[0_10px_30px_rgba(0,0,0,0.5)]">
                        <Trophy size={48} className="text-brand-primary/20" />
                        <p className="text-brand-text/50 font-bold text-lg">No entries yet</p>
                        <p className="text-brand-text/30 text-sm max-w-sm">Be the first to submit a receipt and claim the top spot!</p>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {currentLeaders.map((user) => {
                            const isCurrentUser = userAddress && user.address.toLowerCase() === userAddress;
                            return (
                                <div
                                    key={user.address}
                                    className={`flex items-center justify-between p-4 sm:p-5 rounded-2xl transition-all border ${
                                        isCurrentUser
                                            ? "bg-[#00E36E] text-[#050806] shadow-lg shadow-[#00E36E]/20 scale-[1.01] border-transparent font-extrabold"
                                            : getRankBg(user.displayRank)
                                    }`}
                                >
                                    <div className="flex items-center gap-3 sm:gap-4">
                                        <div className="w-8 flex justify-center shrink-0">
                                            {isCurrentUser ? (
                                                <span className="text-[#050806] font-black text-sm">#{user.displayRank}</span>
                                            ) : (
                                                getRankIcon(user.displayRank)
                                            )}
                                        </div>
                                        <div
                                            className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center text-xl sm:text-2xl shrink-0 ${
                                                isCurrentUser ? "bg-[#050806]/15" : "bg-brand-accent"
                                            }`}
                                        >
                                            {user.hasBadge ? "🏆" : "👤"}
                                        </div>
                                        <div className="min-w-0">
                                            <h3 className="font-black text-sm sm:text-base truncate">
                                                {isCurrentUser ? "You" : formatAddress(user.address)}
                                            </h3>
                                            <p
                                                className={`text-xs ${
                                                    isCurrentUser ? "text-[#050806]/70 font-semibold" : "text-[#8c9790]"
                                                }`}
                                            >
                                                🔥 {user.displayStreak} day streak · Lvl {user.displayLevel}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="text-right shrink-0">
                                        <span className="font-black text-lg sm:text-xl tabular-nums">
                                            {user.displayPoints.toLocaleString()}
                                        </span>
                                        <p
                                            className={`text-[10px] font-bold uppercase tracking-widest ${
                                                isCurrentUser ? "text-[#050806]/55" : "text-brand-text/20"
                                            }`}
                                        >
                                            XP
                                        </p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </Shell>
    );
}

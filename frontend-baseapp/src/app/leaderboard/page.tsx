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
    const { address } = useAccount();
    const userAddress = address?.toLowerCase() || null;

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
            case 1: return "bg-gradient-to-r from-yellow-50 to-amber-50 border-yellow-200/50";
            case 2: return "bg-gradient-to-r from-gray-50 to-slate-50 border-gray-200/50";
            case 3: return "bg-gradient-to-r from-amber-50 to-orange-50 border-amber-200/50";
            default: return "bg-white border-brand-accent/20";
        }
    };

    return (
        <Shell>
            <div className="space-y-8 animate-fade-in-up">
                <div className="text-center lg:text-left space-y-2">
                    <h1 className="text-3xl sm:text-4xl font-black text-brand-primary">Leaderboard</h1>
                    <p className="text-brand-text/60">Top Nutrition Scores on Base</p>
                </div>

                {/* Pool Status + Stats Row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {poolStatus && (
                        <div className="sm:col-span-2 lg:col-span-2 bg-gradient-to-r from-brand-primary to-brand-secondary rounded-3xl p-6 text-white shadow-lg shadow-brand-primary/20">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                <div className="space-y-1">
                                    <span className="text-white/60 text-sm font-medium">Weekly Prize Pool</span>
                                    <p className="text-3xl font-black">${(poolStatus.weeklyPool / 1e6).toFixed(2)} USDC</p>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="px-4 py-2 bg-white/10 rounded-xl backdrop-blur-sm">
                                        <span className="text-sm font-bold">{poolStatus.currentPhase === 0 ? "🟢 FREE" : "💎 PAID"}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                    <div className="glass-card rounded-3xl p-6 flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-brand-accent flex items-center justify-center text-brand-primary">
                            <TrendingUp size={22} />
                        </div>
                        <div>
                            <p className="text-2xl font-black text-brand-primary">{leaders.length}</p>
                            <p className="text-xs font-bold text-brand-text/40 uppercase tracking-wider">Total Players</p>
                        </div>
                    </div>
                </div>

                {/* Leaderboard List */}
                {isLoading ? (
                    <div className="flex items-center justify-center py-20">
                        <Loader2 size={40} className="animate-spin text-brand-primary" />
                    </div>
                ) : leaders.length === 0 ? (
                    <div className="glass-card rounded-3xl flex flex-col items-center justify-center py-20 space-y-3 text-center">
                        <Trophy size={48} className="text-brand-primary/20" />
                        <p className="text-brand-text/50 font-bold text-lg">No entries yet</p>
                        <p className="text-brand-text/30 text-sm max-w-sm">Be the first to submit a receipt and claim the top spot!</p>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {leaders.map((user) => {
                            const isCurrentUser = userAddress && user.address.toLowerCase() === userAddress;
                            return (
                                <div
                                    key={user.rank}
                                    className={`flex items-center justify-between p-4 sm:p-5 rounded-2xl transition-all border ${
                                        isCurrentUser
                                            ? "bg-brand-primary text-white shadow-lg shadow-brand-primary/20 scale-[1.01] border-transparent"
                                            : getRankBg(user.rank)
                                    }`}
                                >
                                    <div className="flex items-center gap-3 sm:gap-4">
                                        <div className="w-8 flex justify-center shrink-0">
                                            {isCurrentUser ? (
                                                <span className="text-white font-black text-sm">#{user.rank}</span>
                                            ) : (
                                                getRankIcon(user.rank)
                                            )}
                                        </div>
                                        <div
                                            className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center text-xl sm:text-2xl shrink-0 ${
                                                isCurrentUser ? "bg-white/20" : "bg-brand-accent"
                                            }`}
                                        >
                                            {user.hasBadge ? "🏆" : "👤"}
                                        </div>
                                        <div className="min-w-0">
                                            <h3 className="font-bold text-sm sm:text-base truncate">
                                                {isCurrentUser ? "You" : formatAddress(user.address)}
                                            </h3>
                                            <p
                                                className={`text-xs ${
                                                    isCurrentUser ? "text-white/60" : "text-brand-text/40"
                                                }`}
                                            >
                                                🔥 {user.streak} day streak · Lvl {user.level}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="text-right shrink-0">
                                        <span className="font-black text-lg sm:text-xl tabular-nums">
                                            {user.totalPoints.toLocaleString()}
                                        </span>
                                        <p
                                            className={`text-[10px] font-bold uppercase tracking-widest ${
                                                isCurrentUser ? "text-white/40" : "text-brand-text/20"
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

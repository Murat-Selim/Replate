"use client";

import React, { useState, useEffect } from "react";
import Shell from "@/components/Shell";
import { Trophy, Medal, Award, Loader2 } from "lucide-react";
import { useBaseAccount } from "@/hooks/useBaseAccount";

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
    const [poolStatus, setPoolStatus] = useState<PoolStatus | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const { address } = useBaseAccount();
    const userAddress = address?.toLowerCase() || null;

    useEffect(() => {
        const fetchLeaderboard = async () => {
            try {
                const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/leaderboard`);
                const data = await response.json();

                if (data.success) {
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

    return (
        <Shell>
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                <div className="text-center space-y-2">
                    <h1 className="text-3xl font-bold text-brand-primary">Leaderboard</h1>
                    <p className="text-brand-text/60">Top waste-preventers on Base</p>
                </div>

                {poolStatus && (
                    <div className="bg-gradient-to-r from-brand-primary to-brand-secondary rounded-3xl p-6 text-white space-y-2">
                        <div className="flex justify-between items-center">
                            <span className="text-white/70 text-sm font-medium">Weekly Prize Pool</span>
                            <span className="text-2xl font-black">${(poolStatus.weeklyPool / 1e6).toFixed(2)} USDC</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-white/70 text-sm font-medium">Phase</span>
                            <span className="font-bold">{poolStatus.currentPhase === 0 ? "FREE" : "PAID"}</span>
                        </div>
                    </div>
                )}

                {isLoading ? (
                    <div className="flex items-center justify-center py-20">
                        <Loader2 size={40} className="animate-spin text-brand-primary" />
                    </div>
                ) : (
                    <div className="space-y-3">
                        {leaders.map((user) => (
                            <div
                                key={user.rank}
                                className={`flex items-center justify-between p-4 rounded-3xl transition-all ${
                                    userAddress && user.address.toLowerCase() === userAddress
                                        ? "bg-brand-primary text-white shadow-lg scale-[1.02]"
                                        : "bg-white border border-brand-accent/20"
                                }`}
                            >
                                <div className="flex items-center gap-4">
                                    <div className="w-8 flex justify-center">
                                        {getRankIcon(user.rank)}
                                    </div>
                                    <div className={`w-12 h-12 rounded-full flex items-center justify-center text-2xl ${
                                        userAddress && user.address.toLowerCase() === userAddress
                                            ? "bg-white/20"
                                            : "bg-brand-accent"
                                    }`}>
                                        {user.hasBadge ? "🏆" : "👤"}
                                    </div>
                                    <div>
                                        <h3 className="font-bold">{formatAddress(user.address)}</h3>
                                        <p className={`text-xs ${
                                            userAddress && user.address.toLowerCase() === userAddress
                                                ? "text-white/60"
                                                : "text-brand-text/40"
                                        }`}>
                                            🔥 {user.streak} day streak
                                        </p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <span className="font-black text-xl">{user.totalPoints.toLocaleString()}</span>
                                    <p className={`text-[10px] font-bold uppercase tracking-widest ${
                                        userAddress && user.address.toLowerCase() === userAddress
                                            ? "text-white/40"
                                            : "text-brand-text/20"
                                    }`}>
                                        XP
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </Shell>
    );
}

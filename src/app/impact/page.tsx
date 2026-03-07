"use client";

import React, { useState, useEffect } from "react";
import Shell from "@/components/Shell";
import { Flame, Star, Leaf, Share2, Loader2 } from "lucide-react";
import { sdk } from "@farcaster/miniapp-sdk";
import { useBaseAccount } from "@/hooks/useBaseAccount";

interface UserSummary {
    totalPoints: number;
    level: number;
    receiptStreak: number;
    checkInStreak: number;
    totalCheckIns: number;
    receiptCount: number;
    hasBadge: boolean;
}

interface WeekReport {
    weekPoints: number;
    receiptCount: number;
    avgHealthScore: number;
    avgNutritionScore: number;
}

export default function YourImpact() {
    const { address } = useBaseAccount();
    const [isLoading, setIsLoading] = useState(true);
    const [isCheckingIn, setIsCheckingIn] = useState(false);
    const [userData, setUserData] = useState<UserSummary>({
        totalPoints: 0,
        level: 0,
        receiptStreak: 0,
        checkInStreak: 0,
        totalCheckIns: 0,
        receiptCount: 0,
        hasBadge: false,
    });
    const [weekReport, setWeekReport] = useState<WeekReport>({
        weekPoints: 0,
        receiptCount: 0,
        avgHealthScore: 0,
        avgNutritionScore: 0,
    });
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchUserData = async () => {
            if (!address || address === "0x0000000000000000000000000000000000000000") {
                setIsLoading(false);
                return;
            }

            try {
                const response = await fetch(
                    `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/user/${address}`
                );
                const data = await response.json();

                if (data.success) {
                    setUserData({
                        totalPoints: data.data.totalPoints,
                        level: data.data.level,
                        receiptStreak: data.data.receiptStreak,
                        checkInStreak: data.data.checkInStreak,
                        totalCheckIns: data.data.totalCheckIns,
                        receiptCount: data.data.receiptCount,
                        hasBadge: data.data.hasBadge,
                    });
                    if (data.data.weekReport) {
                        setWeekReport(data.data.weekReport);
                    }
                } else {
                    throw new Error(data.error || "Failed to fetch");
                }
            } catch (err) {
                console.log("API not available, starting from 0");
                setUserData({
                    totalPoints: 0,
                    level: 0,
                    receiptStreak: 0,
                    checkInStreak: 0,
                    totalCheckIns: 0,
                    receiptCount: 0,
                    hasBadge: false,
                });
                setWeekReport({
                    weekPoints: 0,
                    receiptCount: 0,
                    avgHealthScore: 0,
                    avgNutritionScore: 0,
                });
            } finally {
                setIsLoading(false);
            }
        };

        fetchUserData();
    }, [address]);

    const handleCheckIn = async () => {
        if (!address) {
            setError("Please connect your wallet");
            return;
        }

        setIsCheckingIn(true);
        setError(null);

        try {
            const apiUrl = `${process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:3001'}/api/check-in`;
            console.log("🚀 Sending check-in to:", apiUrl);

            const response = await fetch(apiUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ userAddress: address }),
            });

            console.log("📡 Response status:", response.status);
            const data = await response.json();

            if (data.success) {
                setUserData(prev => ({
                    ...prev,
                    checkInStreak: data.data.newStreak,
                    totalCheckIns: prev.totalCheckIns + 1,
                    totalPoints: prev.totalPoints + data.data.pointsEarned,
                }));
            } else {
                throw new Error(data.error || "Check-in failed");
            }
        } catch (err) {
            console.error("❌ Fetch Error Detail:", err);
            setError(err instanceof Error ? err.message : "Check-in failed");
        } finally {
            setIsCheckingIn(false);
        }
    };

    const handleShare = async () => {
        try {
            await sdk.actions.composeCast({
                text: `🔥 My Replate Streak: ${userData.checkInStreak} days!

⭐ Total XP: ${userData.totalPoints}
🛒 Receipts verified: ${userData.receiptCount}

Join me in reducing food waste!`,
                embeds: ["https://replate.app"],
            });
        } catch (err) {
            console.log("Share cancelled");
        }
    };

    const nutritionScore = userData.receiptCount > 0
        ? Math.min(100, 60 + (userData.totalPoints / userData.receiptCount))
        : 0;

    const currentStreak = Math.max(userData.receiptStreak, userData.checkInStreak);

    return (
        <Shell>
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                <div className="text-center space-y-2">
                    <h1 className="text-3xl font-bold text-brand-primary">Your Impact</h1>
                    <p className="text-brand-text/60">Proudly Onchain on Base</p>
                </div>

                {isLoading ? (
                    <div className="flex items-center justify-center py-20">
                        <Loader2 size={40} className="animate-spin text-brand-primary" />
                    </div>
                ) : (
                    <>
                        {/* Streak Card */}
                        <div className="bg-white rounded-[40px] p-10 shadow-xl border border-brand-accent/20 relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-6 opacity-10 rotate-12 transition-transform group-hover:scale-110 group-hover:rotate-0">
                                <Flame size={120} fill="currentColor" className="text-orange-500" />
                            </div>

                            <div className="relative text-center space-y-4">
                                <h2 className="text-xs font-black uppercase tracking-[0.2em] text-brand-text/30">
                                    Current Streak
                                </h2>
                                <div className="flex items-center justify-center">
                                    <span className="text-9xl font-black text-brand-primary leading-none">
                                        {currentStreak}
                                    </span>
                                    <Flame size={48} fill="#f97316" className="text-orange-500 animate-bounce" />
                                </div>
                                <p className="font-bold text-brand-primary/60">
                                    Verified Shop Streak
                                </p>
                            </div>
                        </div>

                        {/* Stats Grid */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-white p-6 rounded-[32px] border border-brand-accent/20 shadow-sm space-y-2">
                                <div className="w-10 h-10 bg-yellow-100 rounded-2xl flex items-center justify-center text-yellow-600">
                                    <Star size={20} fill="currentColor" />
                                </div>
                                <div>
                                    <p className="text-[10px] font-black uppercase tracking-widest text-brand-text/30">Total XP</p>
                                    <p className="text-2xl font-black text-brand-primary">{userData.totalPoints}</p>
                                </div>
                            </div>

                            <div className="bg-white p-6 rounded-[32px] border border-brand-accent/20 shadow-sm space-y-2">
                                <div className="w-10 h-10 bg-green-100 rounded-2xl flex items-center justify-center text-green-600">
                                    <Leaf size={20} fill="currentColor" />
                                </div>
                                <div>
                                    <p className="text-[10px] font-black uppercase tracking-widest text-brand-text/30">Nutrition Score</p>
                                    <p className="text-xl font-black text-brand-primary leading-tight">Score: {nutritionScore}</p>
                                </div>
                            </div>

                            <div className="bg-white p-6 rounded-[32px] border border-brand-accent/20 shadow-sm space-y-2">
                                <div className="w-10 h-10 bg-blue-100 rounded-2xl flex items-center justify-center text-blue-600">
                                    <Star size={20} fill="currentColor" />
                                </div>
                                <div>
                                    <p className="text-[10px] font-black uppercase tracking-widest text-brand-text/30">Receipts</p>
                                    <p className="text-2xl font-black text-brand-primary">{userData.receiptCount}</p>
                                </div>
                            </div>

                            <div className="bg-white p-6 rounded-[32px] border border-brand-accent/20 shadow-sm space-y-2">
                                <div className="w-10 h-10 bg-purple-100 rounded-2xl flex items-center justify-center text-purple-600">
                                    <Star size={20} fill="currentColor" />
                                </div>
                                <div>
                                    <p className="text-[10px] font-black uppercase tracking-widest text-brand-text/30">Check-ins</p>
                                    <p className="text-2xl font-black text-brand-primary">{userData.totalCheckIns}</p>
                                </div>
                            </div>
                        </div>

                        {/* Weekly Report */}
                        {weekReport.receiptCount > 0 && (
                            <div className="bg-gradient-to-r from-brand-accent/30 to-brand-primary/10 rounded-3xl p-6 space-y-4">
                                <h3 className="text-lg font-black text-brand-primary">This Week</h3>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="text-center">
                                        <p className="text-3xl font-black text-brand-primary">{weekReport.weekPoints}</p>
                                        <p className="text-xs font-bold text-brand-text/50 uppercase">Week XP</p>
                                    </div>
                                    <div className="text-center">
                                        <p className="text-3xl font-black text-brand-primary">{weekReport.avgHealthScore}</p>
                                        <p className="text-xs font-bold text-brand-text/50 uppercase">Avg Health</p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {error && (
                            <div className="bg-red-50 border border-red-200 text-red-600 p-4 rounded-2xl text-sm font-medium">
                                {error}
                            </div>
                        )}

                        <div className="space-y-3">
                            <button
                                onClick={handleCheckIn}
                                disabled={isCheckingIn}
                                className="w-full bg-brand-primary text-white py-5 px-8 rounded-3xl font-black text-xl shadow-xl shadow-brand-primary/20 hover:bg-brand-secondary transition-all active:scale-95 flex items-center justify-center gap-3 disabled:opacity-50"
                            >
                                {isCheckingIn ? (
                                    <>
                                        <Loader2 size={24} className="animate-spin" />
                                        Checking in...
                                    </>
                                ) : (
                                    <>
                                        <Star size={24} fill="currentColor" className="text-yellow-400" />
                                        Daily Check-in
                                    </>
                                )}
                            </button>

                            <button
                                onClick={handleShare}
                                className="w-full bg-brand-accent text-brand-primary py-4 px-8 rounded-2xl font-bold border-2 border-brand-primary/5 hover:bg-brand-accent/80 transition-all active:scale-95 flex items-center justify-center gap-2"
                            >
                                <Share2 size={20} />
                                Share Your Impact
                            </button>
                        </div>
                    </>
                )}
            </div>
        </Shell>
    );
}

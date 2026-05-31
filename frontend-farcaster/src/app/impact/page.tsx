"use client";

import React, { useState, useEffect } from "react";
import Shell from "@/components/Shell";
import { Flame, Star, Leaf, Share2, Loader2, Check } from "lucide-react";
import { sdk } from "@farcaster/miniapp-sdk";
import { useFarcasterAccount } from "@/hooks/useFarcasterAccount";
import { getApiUrl } from "@/lib/api";
import { useConnect } from "wagmi";

interface UserSummary {
    totalPoints: number;
    level: number;
    receiptStreak: number;
    checkInStreak: number;
    totalCheckIns: number;
    receiptCount: number;
    hasBadge: boolean;
    lastCheckInDay: number;
}

interface WeekReport {
    weekPoints: number;
    receiptCount: number;
    avgHealthScore: number;
    avgNutritionScore: number;
}

export default function YourImpact() {
    const { address } = useFarcasterAccount();
    const { connect, connectors } = useConnect();
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
        lastCheckInDay: 0,
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
                const response = await fetch(getApiUrl(`/api/user/${address}`));
                const data = await response.json();

                if (data.success) {
                    // Safety check for lastCheckInDay
                    const today = Math.floor(Date.now() / 1000 / 86400);
                    const lastDay = data.data.lastCheckInDay || 0;
                    
                    setUserData({
                        totalPoints: data.data.totalPoints || 0,
                        level: data.data.level || 0,
                        receiptStreak: data.data.receiptStreak || 0,
                        checkInStreak: data.data.checkInStreak || 0,
                        totalCheckIns: data.data.totalCheckIns || 0,
                        receiptCount: data.data.receiptCount || 0,
                        hasBadge: data.data.hasBadge || false,
                        lastCheckInDay: lastDay,
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
                    lastCheckInDay: 0,
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
            const apiUrl = getApiUrl("/api/check-in");
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
                    lastCheckInDay: Math.floor(Date.now() / 1000 / 86400),
                }));
            } else {
                throw new Error(data.error || "Check-in failed");
            }
        } catch (err) {
            console.error("❌ Check-in Detail:", err);
            const message = err instanceof Error ? err.message : "Check-in failed";
            if (message.includes("Already checked in today")) {
                setError("You've already checked in today! See you tomorrow! ✨");
            } else {
                setError(message);
            }
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
                    <span className="text-[11px] font-extrabold uppercase tracking-[0.25em] text-[#22D97A] font-heading">
                        Onchain Profile
                    </span>
                    <h1 className="text-4xl font-black text-white font-heading uppercase tracking-wide">Your Impact</h1>
                    <p className="text-[#A6B0B5] text-sm">Proudly Onchain on Base</p>
                </div>

                {isLoading ? (
                    <div className="flex items-center justify-center py-20">
                        <Loader2 size={40} className="animate-spin text-[#22D97A]" />
                    </div>
                ) : (
                    <>
                        {/* Streak Card */}
                        <div className="glass-card rounded-[32px] p-8 border border-[#22D97A]/15 relative overflow-hidden group shadow-[0_0_25px_rgba(34,217,122,0.05)]">
                            <div className="absolute top-0 right-0 p-6 opacity-5 rotate-12 transition-transform group-hover:scale-110 group-hover:rotate-0">
                                <Flame size={120} fill="currentColor" className="text-[#22D97A]" />
                            </div>

                            <div className="relative text-center space-y-3">
                                <h2 className="text-xs font-black uppercase tracking-[0.2em] text-[#A6B0B5] font-heading">
                                    Current Streak
                                </h2>
                                <div className="flex items-center justify-center gap-2">
                                    <span className="text-8xl font-black text-white leading-none font-heading">
                                        {currentStreak}
                                    </span>
                                    <Flame size={40} fill="#22D97A" className="text-[#22D97A] animate-pulse" />
                                </div>
                                <p className="font-extrabold text-[#22D97A] text-xs uppercase tracking-wider font-heading">
                                    Verified Streak Days
                                </p>
                            </div>
                        </div>

                        {/* Stats Grid */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="glass-card p-6 rounded-[24px] border border-[#22D97A]/10 hover:border-[#22D97A]/20 transition-all space-y-3">
                                <div className="w-10 h-10 bg-[#131C20] border border-[#22D97A]/20 rounded-xl flex items-center justify-center text-[#22D97A]">
                                    <Star size={18} fill="currentColor" />
                                </div>
                                <div>
                                    <p className="text-[9px] font-black uppercase tracking-widest text-[#A6B0B5]">Total XP</p>
                                    <p className="text-2xl font-black text-white font-heading mt-0.5">{userData.totalPoints}</p>
                                </div>
                            </div>

                            <div className="glass-card p-6 rounded-[24px] border border-[#22D97A]/10 hover:border-[#22D97A]/20 transition-all space-y-3">
                                <div className="w-10 h-10 bg-[#131C20] border border-[#22D97A]/20 rounded-xl flex items-center justify-center text-[#22D97A]">
                                    <Leaf size={18} fill="currentColor" />
                                </div>
                                <div>
                                    <p className="text-[9px] font-black uppercase tracking-widest text-[#A6B0B5]">Nutrition Score</p>
                                    <p className="text-xl font-black text-white font-heading mt-0.5 leading-tight">{nutritionScore}</p>
                                </div>
                            </div>

                            <div className="glass-card p-6 rounded-[24px] border border-[#22D97A]/10 hover:border-[#22D97A]/20 transition-all space-y-3">
                                <div className="w-10 h-10 bg-[#131C20] border border-[#22D97A]/20 rounded-xl flex items-center justify-center text-[#22D97A]">
                                    <Star size={18} fill="currentColor" />
                                </div>
                                <div>
                                    <p className="text-[9px] font-black uppercase tracking-widest text-[#A6B0B5]">Receipts</p>
                                    <p className="text-2xl font-black text-white font-heading mt-0.5">{userData.receiptCount}</p>
                                </div>
                            </div>

                            <div className="glass-card p-6 rounded-[24px] border border-[#22D97A]/10 hover:border-[#22D97A]/20 transition-all space-y-3">
                                <div className="w-10 h-10 bg-[#131C20] border border-[#22D97A]/20 rounded-xl flex items-center justify-center text-[#22D97A]">
                                    <Star size={18} fill="currentColor" />
                                </div>
                                <div>
                                    <p className="text-[9px] font-black uppercase tracking-widest text-[#A6B0B5]">Check-ins</p>
                                    <p className="text-2xl font-black text-white font-heading mt-0.5">{userData.totalCheckIns}</p>
                                </div>
                            </div>
                        </div>

                        {/* Weekly Report */}
                        {weekReport.receiptCount > 0 && (
                            <div className="glass-card rounded-[28px] p-6 border border-[#22D97A]/20 space-y-4">
                                <h3 className="text-base font-black text-[#22D97A] font-heading uppercase tracking-wide">This Week</h3>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="text-center">
                                        <p className="text-3xl font-black text-white font-heading">{weekReport.weekPoints}</p>
                                        <p className="text-[9px] font-black text-[#A6B0B5] uppercase tracking-wider">Week XP</p>
                                    </div>
                                    <div className="text-center">
                                        <p className="text-3xl font-black text-white font-heading">{weekReport.avgHealthScore}</p>
                                        <p className="text-[9px] font-black text-[#A6B0B5] uppercase tracking-wider">Avg Health</p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {error && (
                            <div className="bg-[#1E2A2F] border border-red-500/30 text-red-400 p-5 rounded-[22px] text-sm font-bold text-center">
                                {error}
                            </div>
                        )}

                        <div className="space-y-3">
                            {!address ? (
                                <button
                                    onClick={() => {
                                        const connector = connectors.find(c => c.id === "farcasterMiniApp") || connectors[0];
                                        if (connector) connect({ connector });
                                    }}
                                    className="w-full bg-[#22D97A] text-[#0B1114] py-5 px-8 rounded-full font-black text-lg uppercase tracking-wider flex items-center justify-center gap-3 transition-all active:scale-95 shadow-[0_0_30px_rgba(34,217,122,0.4)] hover:shadow-[0_0_40px_rgba(34,217,122,0.6)] cursor-pointer"
                                >
                                    <Star size={20} fill="currentColor" className="text-[#0B1114]" />
                                    Connect Wallet
                                </button>
                            ) : (
                                <button
                                    onClick={handleCheckIn}
                                    disabled={isCheckingIn || userData.lastCheckInDay >= Math.floor(Date.now() / 1000 / 86400)}
                                    className="w-full bg-[#22D97A] text-[#0B1114] py-5 px-8 rounded-full font-black text-lg uppercase tracking-wider flex items-center justify-center gap-3 transition-all active:scale-95 disabled:opacity-50 shadow-[0_0_30px_rgba(34,217,122,0.4)] hover:shadow-[0_0_40px_rgba(34,217,122,0.6)] cursor-pointer"
                                >
                                    {isCheckingIn ? (
                                        <>
                                            <Loader2 size={20} className="animate-spin" />
                                            Checking in...
                                        </>
                                    ) : userData.lastCheckInDay >= Math.floor(Date.now() / 1000 / 86400) ? (
                                        <>
                                            <Check size={20} strokeWidth={3} />
                                            Checked In Today
                                        </>
                                    ) : (
                                        <>
                                            <Star size={20} fill="currentColor" className="text-[#0B1114]" />
                                            Daily Check-in
                                        </>
                                    )}
                                </button>
                            )}

                            <button
                                onClick={handleShare}
                                className="w-full bg-[#1E2A2F] border border-[#22D97A]/25 text-[#22D97A] py-4 px-8 rounded-full font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2 hover:bg-[#22D97A]/10 transition-all active:scale-95 cursor-pointer"
                            >
                                <Share2 size={18} />
                                Share Your Impact
                            </button>
                        </div>
                    </>
                )}
            </div>
        </Shell>
    );
}

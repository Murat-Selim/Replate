"use client";

import React, { useState } from "react";
import Shell from "@/components/Shell";
import { Flame, Star, Leaf, Share2, Loader2, Check, Trophy, Receipt, CalendarCheck } from "lucide-react";
import { useAccount, useReadContract } from "wagmi";
import { CONTRACT_ADDRESS, REPLATE_QUEST_ABI } from "@/lib/contract";
import { getApiUrl } from "@/lib/api";
import { useCheckIn } from "@/lib/useTransaction";

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
    const { address } = useAccount();
    const { checkIn } = useCheckIn();
    const [isCheckingIn, setIsCheckingIn] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Contract Reads
    const { data: summaryData, isLoading: isSummaryLoading, refetch: refetchSummary } = useReadContract({
        address: CONTRACT_ADDRESS,
        abi: REPLATE_QUEST_ABI,
        functionName: 'getUserSummary',
        args: address ? [address] : undefined,
        query: { enabled: !!address }
    });

    const { data: reportData, isLoading: isReportLoading } = useReadContract({
        address: CONTRACT_ADDRESS,
        abi: REPLATE_QUEST_ABI,
        functionName: 'getCurrentWeekReport',
        args: address ? [address] : undefined,
        query: { enabled: !!address }
    });

    const { data: lastCheckInDayData, refetch: refetchLastCheckInDay } = useReadContract({
        address: CONTRACT_ADDRESS,
        abi: REPLATE_QUEST_ABI,
        functionName: 'lastCheckInDay',
        args: address ? [address] : undefined,
        query: { enabled: !!address }
    });

    // Map contract data to our interfaces
    const userData: UserSummary = summaryData ? {
        totalPoints: Number(summaryData[0]),
        level: Number(summaryData[1]),
        receiptStreak: Number(summaryData[2]),
        checkInStreak: Number(summaryData[3]),
        totalCheckIns: Number(summaryData[4]),
        receiptCount: Number(summaryData[5]),
        hasBadge: summaryData[6],
        lastCheckInDay: Number(lastCheckInDayData || 0),
    } : {
        totalPoints: 0,
        level: 0,
        receiptStreak: 0,
        checkInStreak: 0,
        totalCheckIns: 0,
        receiptCount: 0,
        hasBadge: false,
        lastCheckInDay: 0,
    };

    const weekReport: WeekReport = reportData ? {
        weekPoints: Number(reportData[0]),
        receiptCount: Number(reportData[1]),
        avgHealthScore: Number(reportData[2]),
        avgNutritionScore: Number(reportData[3]),
    } : {
        weekPoints: 0,
        receiptCount: 0,
        avgHealthScore: 0,
        avgNutritionScore: 0,
    };

    const isLoading = isSummaryLoading || isReportLoading;

    const handleCheckIn = async () => {
        if (!address) {
            setError("Please connect your wallet");
            return;
        }

        setIsCheckingIn(true);
        setError(null);

        try {
            const res = await checkIn();
            if (res.success) {
                refetchSummary();
                refetchLastCheckInDay();
            } else {
                throw new Error(res.error || "Check-in failed");
            }
        } catch (err: any) {
            const message = err?.message || "Check-in failed";
            if (message.includes("Already checked in today")) {
                setError("You've already checked in today! ✨");
            } else {
                setError(message);
            }
        } finally {
            setIsCheckingIn(false);
        }
    };

    const handleShare = () => {
        const shareText = `🔥 My Replate Streak: ${currentStreak} days!\n\n⭐ Total XP: ${userData.totalPoints}\n🛒 Receipts verified: ${userData.receiptCount}\n\nJoin me in reducing food waste!`;
        window.open(`https://warpcast.com/~/compose?text=${encodeURIComponent(shareText)}`, '_blank');
    };

    const nutritionScore = userData.receiptCount > 0
        ? Math.min(100, 60 + (userData.totalPoints / userData.receiptCount))
        : 0;

    const currentStreak = Math.max(userData.receiptStreak, userData.checkInStreak);

    return (
        <Shell>
            <div className="space-y-8 animate-fade-in-up">
                <div className="text-center lg:text-left space-y-2">
                    <h1 className="text-3xl sm:text-4xl font-black text-brand-primary">Your Impact</h1>
                    <p className="text-brand-text/60">Proudly Onchain on Base</p>
                </div>

                {!address ? (
                    <div className="bg-[#0c1310]/90 border border-[#00E36E]/12 backdrop-blur-2xl rounded-3xl flex flex-col items-center justify-center py-20 space-y-4 shadow-[0_10px_30px_rgba(0,0,0,0.5)]">
                        <Trophy size={48} className="text-brand-primary/20" />
                        <p className="text-brand-text/60 font-bold">Connect your wallet to see your impact</p>
                    </div>
                ) : isLoading ? (
                    <div className="flex items-center justify-center py-20">
                        <Loader2 size={40} className="animate-spin text-brand-primary" />
                    </div>
                ) : (
                    <>
                        {/* Top Row: Streak + Level */}
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6">
                            {/* Streak Card — Spans 2 cols on desktop */}
                            <div className="lg:col-span-2 bg-[#0c1310]/90 border border-[#00E36E]/12 backdrop-blur-2xl rounded-3xl p-8 sm:p-10 relative overflow-hidden group shadow-[0_10px_30px_rgba(0,0,0,0.5)]">
                                <div className="absolute top-0 right-0 p-6 opacity-10 rotate-12 transition-transform group-hover:scale-110 group-hover:rotate-0">
                                    <Flame size={120} fill="currentColor" className="text-orange-500" />
                                </div>

                                <div className="relative flex flex-col sm:flex-row items-center gap-6">
                                    <div className="text-center sm:text-left">
                                        <h2 className="text-xs font-black uppercase tracking-[0.2em] text-brand-text/30 mb-2">
                                            Current Streak
                                        </h2>
                                        <div className="flex items-center gap-2">
                                            <span className="text-8xl sm:text-9xl font-black text-brand-primary leading-none tabular-nums">
                                                {currentStreak}
                                            </span>
                                            <Flame size={40} fill="#f97316" className="text-orange-500 animate-bounce" />
                                        </div>
                                        <p className="font-bold text-brand-primary/60 mt-2">
                                            Verified Streak
                                        </p>
                                    </div>

                                    {/* Level indicator */}
                                    <div className="sm:ml-auto text-center">
                                        <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gradient-to-br from-[#00E36E] to-[#05CE67] flex items-center justify-center shadow-xl shadow-[#00E36E]/20">
                                            <div className="text-center">
                                                <p className="text-3xl sm:text-4xl font-black text-[#050806] leading-none">{userData.level}</p>
                                                <p className="text-[9px] font-bold text-[#050806]/70 uppercase tracking-widest">Level</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Badge Card */}
                            <div className="bg-[#0c1310]/90 border border-[#00E36E]/12 backdrop-blur-2xl rounded-3xl p-6 sm:p-8 flex flex-col items-center justify-center text-center space-y-3 shadow-[0_10px_30px_rgba(0,0,0,0.5)]">
                                <div className="w-16 h-16 rounded-full bg-brand-accent flex items-center justify-center text-4xl">
                                    {userData.hasBadge ? "🏆" : "🔒"}
                                </div>
                                <div>
                                    <p className="font-black text-brand-primary">
                                        {userData.hasBadge ? "Badge Earned" : "No Badge Yet"}
                                    </p>
                                    <p className="text-xs text-brand-text/40">
                                        {userData.hasBadge
                                            ? "Healthy Shopper NFT"
                                            : "Score 60+ on both metrics"}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Stats Grid */}
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                            <div className="bg-[#0c1310]/90 border border-[#00E36E]/12 backdrop-blur-2xl hover:border-[#00E36E]/25 transition-all duration-300 p-5 sm:p-6 rounded-3xl space-y-3 shadow-[0_10px_30px_rgba(0,0,0,0.5)]">
                                <div className="w-10 h-10 bg-yellow-500/10 rounded-2xl flex items-center justify-center text-yellow-400">
                                    <Star size={20} fill="currentColor" />
                                </div>
                                <div>
                                    <p className="text-[10px] font-black uppercase tracking-widest text-[#8c9790]/50">Total XP</p>
                                    <p className="text-2xl sm:text-3xl font-black text-white tabular-nums">{userData.totalPoints.toLocaleString()}</p>
                                </div>
                            </div>

                            <div className="bg-[#0c1310]/90 border border-[#00E36E]/12 backdrop-blur-2xl hover:border-[#00E36E]/25 transition-all duration-300 p-5 sm:p-6 rounded-3xl space-y-3 shadow-[0_10px_30px_rgba(0,0,0,0.5)]">
                                <div className="w-10 h-10 bg-[#00E36E]/10 rounded-2xl flex items-center justify-center text-[#00E36E]">
                                    <Leaf size={20} fill="currentColor" />
                                </div>
                                <div>
                                    <p className="text-[10px] font-black uppercase tracking-widest text-[#8c9790]/50">Nutrition</p>
                                    <p className="text-2xl sm:text-3xl font-black text-white tabular-nums">{Math.round(nutritionScore)}</p>
                                </div>
                            </div>

                            <div className="bg-[#0c1310]/90 border border-[#00E36E]/12 backdrop-blur-2xl hover:border-[#00E36E]/25 transition-all duration-300 p-5 sm:p-6 rounded-3xl space-y-3 shadow-[0_10px_30px_rgba(0,0,0,0.5)]">
                                <div className="w-10 h-10 bg-blue-500/10 rounded-2xl flex items-center justify-center text-blue-400">
                                    <Receipt size={20} />
                                </div>
                                <div>
                                    <p className="text-[10px] font-black uppercase tracking-widest text-[#8c9790]/50">Receipts</p>
                                    <p className="text-2xl sm:text-3xl font-black text-white tabular-nums">{userData.receiptCount}</p>
                                </div>
                            </div>

                            <div className="bg-[#0c1310]/90 border border-[#00E36E]/12 backdrop-blur-2xl hover:border-[#00E36E]/25 transition-all duration-300 p-5 sm:p-6 rounded-3xl space-y-3 shadow-[0_10px_30px_rgba(0,0,0,0.5)]">
                                <div className="w-10 h-10 bg-purple-500/10 rounded-2xl flex items-center justify-center text-purple-400">
                                    <CalendarCheck size={20} />
                                </div>
                                <div>
                                    <p className="text-[10px] font-black uppercase tracking-widest text-[#8c9790]/50">Check-ins</p>
                                    <p className="text-2xl sm:text-3xl font-black text-white tabular-nums">{userData.totalCheckIns}</p>
                                </div>
                            </div>
                        </div>

                        {/* Weekly Report */}
                        {weekReport.receiptCount > 0 && (
                            <div className="bg-[#0c1310]/90 border border-[#00E36E]/12 backdrop-blur-2xl rounded-3xl p-6 sm:p-8 space-y-4 shadow-[0_10px_30px_rgba(0,0,0,0.5)]">
                                <h3 className="text-lg font-black text-brand-primary">This Week</h3>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                    <div className="text-center sm:text-left">
                                        <p className="text-3xl font-black text-brand-primary tabular-nums">{weekReport.weekPoints}</p>
                                        <p className="text-xs font-bold text-brand-text/50 uppercase">Week XP</p>
                                    </div>
                                    <div className="text-center sm:text-left">
                                        <p className="text-3xl font-black text-brand-primary tabular-nums">{weekReport.avgHealthScore}</p>
                                        <p className="text-xs font-bold text-brand-text/50 uppercase">Avg Health</p>
                                    </div>
                                    <div className="text-center sm:text-left">
                                        <p className="text-3xl font-black text-brand-primary tabular-nums">{weekReport.avgNutritionScore}</p>
                                        <p className="text-xs font-bold text-brand-text/50 uppercase">Avg Nutrition</p>
                                    </div>
                                    <div className="text-center sm:text-left">
                                        <p className="text-3xl font-black text-brand-primary tabular-nums">{weekReport.receiptCount}</p>
                                        <p className="text-xs font-bold text-brand-text/50 uppercase">Receipts</p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {error && (
                            <div className="bg-red-950/40 border border-red-800/30 text-red-400 p-4 rounded-2xl text-sm font-medium text-center shadow-[0_0_15px_rgba(239,68,68,0.1)]">
                                {error}
                            </div>
                        )}

                        {/* Action Buttons */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <button
                                onClick={handleCheckIn}
                                disabled={isCheckingIn || userData.lastCheckInDay >= Math.floor(Date.now() / 1000 / 86400)}
                                className="bg-[#00E36E] hover:bg-[#00FF66] text-[#050806] py-4 px-8 rounded-2xl font-black text-lg shadow-xl shadow-[#00E36E]/20 hover:shadow-2xl transition-all active:scale-[0.98] flex items-center justify-center gap-3 disabled:opacity-40"
                            >
                                {isCheckingIn ? (
                                    <>
                                        <Loader2 size={22} className="animate-spin" />
                                        Checking in...
                                    </>
                                ) : userData.lastCheckInDay >= Math.floor(Date.now() / 1000 / 86400) ? (
                                    <>
                                        <Check size={22} className="text-green-400" />
                                        Checked In Today
                                    </>
                                ) : (
                                    <>
                                        <Star size={22} fill="currentColor" className="text-[#050806]" />
                                        Daily Check-in
                                    </>
                                )}
                            </button>

                            <button
                                onClick={handleShare}
                                className="bg-white/[0.04] text-[#00E36E] border border-[#00E36E]/20 hover:bg-white/[0.08] hover:text-white transition-all py-4 px-8 rounded-2xl font-bold text-lg active:scale-[0.98] flex items-center justify-center gap-2"
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

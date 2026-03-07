"use client";

import React, { useState, useRef, useEffect } from "react";
import Shell from "@/components/Shell";
import { Minus, Plus, Sparkles, Camera, Check, Loader2, X, Leaf, Star, Trophy } from "lucide-react";
import { sdk } from "@farcaster/miniapp-sdk";
import { useBaseAccount } from "@/hooks/useBaseAccount";

interface VerificationResult {
    txHash: string;
    healthScore: number;
    nutritionScore: number;
    totalItems: number;
    healthyItems: number;
    unhealthyItems: number;
    fruitVegGrams: number;
    daysCovered: number;
    pointsEarned: number;
    badgeMinted: boolean;
}

interface UserContext {
    address?: string;
    fid?: number;
    username?: string;
}

export default function SmartShop() {
    const { address } = useBaseAccount();
    const [userContext, setUserContext] = useState<UserContext>({});
    const [householdSize, setHouseholdSize] = useState(2);
    const [duration, setDuration] = useState(7);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [result, setResult] = useState<VerificationResult | null>(null);
    const [error, setError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const fetchContext = async () => {
            try {
                const context = await sdk.context;
                if (context?.user) {
                    setUserContext({
                        address,
                        fid: context.user.fid,
                        username: context.user.username,
                    });
                }
            } catch (err) {
                console.log("Not running in MiniApp context");
            }
        };
        fetchContext();
    }, [address]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setImagePreview(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const triggerFileInput = () => {
        fileInputRef.current?.click();
    };

    const handleVerify = async () => {
        const targetAddress = address || userContext.address;

        if (!imagePreview || !targetAddress) {
            setError("Please upload a receipt and ensure you're connected");
            return;
        }

        setIsLoading(true);
        setError(null);
        setResult(null);

        try {
            const base64Data = imagePreview.split(",")[1] || imagePreview;

            const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/verify-receipt`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    imageBase64: base64Data,
                    userAddress: targetAddress,
                    householdSize,
                    fid: userContext.fid,
                }),
            });

            const data = await response.json();

            if (!data.success) {
                throw new Error(data.error || "Verification failed");
            }

            setResult(data.data);
        } catch (err) {
            setError(err instanceof Error ? err.message : "An error occurred");
        } finally {
            setIsLoading(false);
        }
    };

    const handleShare = async () => {
        if (!result) return;

        try {
            await sdk.actions.composeCast({
                text: `🎉 I just verified my grocery receipt on Replate! 

🥗 Health Score: ${result.healthScore}/100
🌿 Nutrition Score: ${result.nutritionScore}/100
⭐ Earned ${result.pointsEarned} XP

Join me in reducing food waste!`,
                embeds: ["https://replate.app"],
            });
        } catch (err) {
            console.log("Share cancelled or failed");
        }
    };

    const resetForm = () => {
        setImagePreview(null);
        setResult(null);
        setError(null);
    };

    return (
        <Shell>
            <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
                {/* Combined Header Area */}
                <div className="text-center space-y-2">
                    <h1 className="text-4xl font-black text-brand-primary">Shop & Verify</h1>
                    <p className="text-brand-text/60">Upload receipt and generate your smart list.</p>
                </div>

                {/* Section 1: Verify (Top) */}
                <div className="space-y-6">
                    <div className="flex flex-col items-center justify-center pt-4">
                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleFileChange}
                            accept="image/*"
                            className="hidden"
                        />
                        <div
                            onClick={triggerFileInput}
                            className="relative group cursor-pointer"
                        >
                            <div className="absolute inset-0 bg-brand-primary/5 rounded-full blur-3xl group-hover:bg-brand-primary/10 transition-colors"></div>
                            <div className="relative w-56 h-56 bg-white rounded-full shadow-xl border-4 border-white flex flex-col items-center justify-center overflow-hidden transition-transform group-hover:scale-105 active:scale-95">
                                {imagePreview ? (
                                    <div className="relative w-full h-full">
                                        <img
                                            src={imagePreview}
                                            alt="Receipt preview"
                                            className="w-full h-full object-cover"
                                        />
                                        <div className="absolute inset-0 bg-brand-primary/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                            <div className="bg-white/20 backdrop-blur-md p-4 rounded-full border border-white/30">
                                                <Camera size={32} className="text-white" />
                                            </div>
                                        </div>
                                        <div className="absolute top-4 right-4 bg-green-500 text-white p-2 rounded-full shadow-lg">
                                            <Check size={20} />
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center gap-3">
                                        <div className="w-20 h-20 bg-brand-accent/50 rounded-[24px] flex items-center justify-center text-brand-primary">
                                            <Camera size={40} />
                                        </div>
                                        <span className="font-bold text-brand-text/40 uppercase tracking-widest text-[10px]">
                                            Tap to upload
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Section 2: Smart Shop Controls */}
                <div className="space-y-8">
                    <div className="space-y-6">
                        {/* Household Size */}
                        <div className="bg-white rounded-[32px] p-8 shadow-sm border border-brand-accent/20 space-y-4">
                            <h2 className="text-center text-xs font-black uppercase tracking-[0.2em] text-brand-text/30">
                                Household Size
                            </h2>
                            <div className="flex items-center justify-center gap-8">
                                <button
                                    onClick={() => setHouseholdSize(Math.max(1, householdSize - 1))}
                                    className="w-12 h-12 rounded-full bg-brand-primary text-white flex items-center justify-center active:scale-90 transition-transform shadow-lg shadow-brand-primary/20"
                                >
                                    <Minus size={24} />
                                </button>
                                <span className="text-6xl font-black text-brand-primary w-20 text-center">
                                    {householdSize}
                                </span>
                                <button
                                    onClick={() => setHouseholdSize(householdSize + 1)}
                                    className="w-12 h-12 rounded-full bg-brand-primary text-white flex items-center justify-center active:scale-90 transition-transform shadow-lg shadow-brand-primary/20"
                                >
                                    <Plus size={24} />
                                </button>
                            </div>
                        </div>

                        {/* Shopping Duration */}
                        <div className="bg-white rounded-[32px] p-8 shadow-sm border border-brand-accent/20 space-y-4">
                            <h2 className="text-center text-xs font-black uppercase tracking-[0.2em] text-brand-text/30">
                                Shopping Duration
                            </h2>
                            <div className="flex items-center justify-center gap-8">
                                <button
                                    onClick={() => setDuration(Math.max(1, duration - 1))}
                                    className="w-12 h-12 rounded-full bg-brand-primary text-white flex items-center justify-center active:scale-90 transition-transform shadow-lg shadow-brand-primary/20"
                                >
                                    <Minus size={24} />
                                </button>
                                <div className="flex items-baseline gap-2 w-32 justify-center">
                                    <span className="text-6xl font-black text-brand-primary">
                                        {duration}
                                    </span>
                                    <span className="text-brand-text/30 font-bold">days</span>
                                </div>
                                <button
                                    onClick={() => setDuration(duration + 1)}
                                    className="w-12 h-12 rounded-full bg-brand-primary text-white flex items-center justify-center active:scale-90 transition-transform shadow-lg shadow-brand-primary/20"
                                >
                                    <Plus size={24} />
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <button
                            onClick={handleVerify}
                            disabled={isLoading || !imagePreview}
                            className="w-full bg-brand-primary text-white py-5 px-8 rounded-3xl font-black text-xl shadow-xl shadow-brand-primary/20 hover:bg-brand-secondary transition-all active:scale-95 flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isLoading ? (
                                <>
                                    <Loader2 size={24} className="animate-spin" />
                                    Verifying...
                                </>
                            ) : (
                                <>
                                    <Sparkles size={24} />
                                    Verify & Earn
                                </>
                            )}
                        </button>

                        {error && (
                            <div className="bg-red-50 border border-red-200 text-red-600 p-4 rounded-2xl text-sm font-medium">
                                {error}
                            </div>
                        )}

                        {result && (
                            <div className="bg-white rounded-[32px] p-6 shadow-xl border-2 border-green-500/30 space-y-4">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-lg font-black text-brand-primary">Verification Complete!</h3>
                                    <button onClick={resetForm} className="p-2 hover:bg-brand-accent/20 rounded-full">
                                        <X size={20} className="text-brand-text/50" />
                                    </button>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div className="bg-brand-accent/30 p-4 rounded-2xl text-center">
                                        <div className="flex items-center justify-center gap-1 text-green-600 mb-1">
                                            <Leaf size={16} fill="currentColor" />
                                        </div>
                                        <p className="text-2xl font-black text-brand-primary">{result.healthScore}</p>
                                        <p className="text-[10px] font-bold text-brand-text/50 uppercase">Health Score</p>
                                    </div>
                                    <div className="bg-brand-accent/30 p-4 rounded-2xl text-center">
                                        <div className="flex items-center justify-center gap-1 text-yellow-600 mb-1">
                                            <Star size={16} fill="currentColor" />
                                        </div>
                                        <p className="text-2xl font-black text-brand-primary">{result.nutritionScore}</p>
                                        <p className="text-[10px] font-bold text-brand-text/50 uppercase">Nutrition</p>
                                    </div>
                                    <div className="bg-brand-accent/30 p-4 rounded-2xl text-center">
                                        <div className="flex items-center justify-center gap-1 text-brand-primary mb-1">
                                            <Trophy size={16} fill="currentColor" />
                                        </div>
                                        <p className="text-2xl font-black text-brand-primary">+{result.pointsEarned}</p>
                                        <p className="text-[10px] font-bold text-brand-text/50 uppercase">XP Earned</p>
                                    </div>
                                    <div className="bg-brand-accent/30 p-4 rounded-2xl text-center">
                                        <div className="flex items-center justify-center gap-1 text-green-600 mb-1">
                                            <Leaf size={16} fill="currentColor" />
                                        </div>
                                        <p className="text-2xl font-black text-brand-primary">{result.fruitVegGrams}g</p>
                                        <p className="text-[10px] font-bold text-brand-text/50 uppercase">Fruits & Veg</p>
                                    </div>
                                </div>

                                {result.badgeMinted && (
                                    <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-4 text-center">
                                        <p className="text-lg font-black text-yellow-600">🏆 Badge Earned!</p>
                                        <p className="text-xs text-yellow-600/70">You've unlocked the Healthy Shopper badge</p>
                                    </div>
                                )}

                                <div className="text-xs text-brand-text/40 text-center break-all">
                                    TX: {result.txHash.slice(0, 10)}...{result.txHash.slice(-8)}
                                </div>

                                <div className="flex gap-2 pt-2">
                                    <button
                                        onClick={handleShare}
                                        className="flex-1 bg-[#1DA1F2] text-white py-3 px-4 rounded-2xl font-bold text-sm hover:bg-[#1a9ed8] transition-all flex items-center justify-center gap-2"
                                    >
                                        Share Result
                                    </button>
                                    <button
                                        onClick={resetForm}
                                        className="flex-1 bg-brand-accent text-brand-primary py-3 px-4 rounded-2xl font-bold text-sm hover:bg-brand-accent/80 transition-all"
                                    >
                                        Verify Another
                                    </button>
                                </div>
                            </div>
                        )}

                        <div className="bg-brand-accent/40 p-5 rounded-[24px] border border-brand-accent/50 text-center">
                            <p className="text-sm text-brand-text/50 italic font-medium">
                                "Eat healthier and more balanced with a {duration} day plan."
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </Shell>
    );
}

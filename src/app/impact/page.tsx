"use client";

import React from "react";
import Shell from "@/components/Shell";
import { Flame, Star, Leaf, Share2 } from "lucide-react";

export default function YourImpact() {
    return (
        <Shell>
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                <div className="text-center space-y-2">
                    <h1 className="text-3xl font-bold text-brand-primary">Your Impact</h1>
                    <p className="text-brand-text/60">Proudly Onchain on Base</p>
                </div>

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
                                3
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
                            <p className="text-2xl font-black text-brand-primary">450</p>
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-[32px] border border-brand-accent/20 shadow-sm space-y-2">
                        <div className="w-10 h-10 bg-green-100 rounded-2xl flex items-center justify-center text-green-600">
                            <Leaf size={20} fill="currentColor" />
                        </div>
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-brand-text/30">CO2 Saved</p>
                            <p className="text-2xl font-black text-brand-primary">12.5kg</p>
                        </div>
                    </div>
                </div>

                <button className="w-full bg-brand-accent text-brand-primary py-4 px-8 rounded-2xl font-bold border-2 border-brand-primary/5 hover:bg-brand-accent/80 transition-all active:scale-95 flex items-center justify-center gap-2">
                    <Share2 size={20} />
                    Share Your Impact
                </button>
            </div>
        </Shell>
    );
}

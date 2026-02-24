"use client";

import React, { useState } from "react";
import Shell from "@/components/Shell";
import { Minus, Plus, Sparkles } from "lucide-react";

export default function SmartShop() {
    const [householdSize, setHouseholdSize] = useState(2);
    const [duration, setDuration] = useState(7);

    return (
        <Shell>
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                <div className="text-center space-y-2">
                    <h1 className="text-3xl font-bold text-brand-primary">Smart Shop</h1>
                    <p className="text-brand-text/60">Buy just enough, waste nothing.</p>
                </div>

                <div className="space-y-6">
                    {/* Household Size */}
                    <div className="bg-white rounded-3xl p-8 shadow-sm border border-brand-accent/20 space-y-4">
                        <h2 className="text-center text-sm font-bold uppercase tracking-widest text-brand-text/40">
                            Household Size
                        </h2>
                        <div className="flex items-center justify-center gap-8">
                            <button
                                onClick={() => setHouseholdSize(Math.max(1, householdSize - 1))}
                                className="w-12 h-12 rounded-full bg-brand-primary text-white flex items-center justify-center active:scale-90 transition-transform"
                            >
                                <Minus size={24} />
                            </button>
                            <span className="text-6xl font-black text-brand-primary w-20 text-center">
                                {householdSize}
                            </span>
                            <button
                                onClick={() => setHouseholdSize(householdSize + 1)}
                                className="w-12 h-12 rounded-full bg-brand-primary text-white flex items-center justify-center active:scale-90 transition-transform"
                            >
                                <Plus size={24} />
                            </button>
                        </div>
                    </div>

                    {/* Shopping Duration */}
                    <div className="bg-white rounded-3xl p-8 shadow-sm border border-brand-accent/20 space-y-4">
                        <h2 className="text-center text-sm font-bold uppercase tracking-widest text-brand-text/40">
                            Shopping Duration
                        </h2>
                        <div className="flex items-center justify-center gap-8">
                            <button
                                onClick={() => setDuration(Math.max(1, duration - 1))}
                                className="w-12 h-12 rounded-full bg-brand-primary text-white flex items-center justify-center active:scale-90 transition-transform"
                            >
                                <Minus size={24} />
                            </button>
                            <div className="flex items-baseline gap-2 w-32 justify-center">
                                <span className="text-6xl font-black text-brand-primary">
                                    {duration}
                                </span>
                                <span className="text-brand-text/40 font-bold">days</span>
                            </div>
                            <button
                                onClick={() => setDuration(duration + 1)}
                                className="w-12 h-12 rounded-full bg-brand-primary text-white flex items-center justify-center active:scale-90 transition-transform"
                            >
                                <Plus size={24} />
                            </button>
                        </div>
                    </div>
                </div>

                <button className="w-full bg-brand-primary text-white py-5 px-8 rounded-2xl font-bold text-xl shadow-xl hover:bg-brand-secondary transition-all active:scale-95 flex items-center justify-center gap-3">
                    <Sparkles size={24} />
                    Generate Smart List
                </button>

                <div className="bg-brand-accent/50 p-4 rounded-2xl border border-brand-accent text-center">
                    <p className="text-sm text-brand-text/60 italic">
                        "Planning for {duration} days will save approximately {(duration * householdSize * 0.17).toFixed(1)}kg of food waste for a household of {householdSize}."
                    </p>
                </div>
            </div>
        </Shell>
    );
}

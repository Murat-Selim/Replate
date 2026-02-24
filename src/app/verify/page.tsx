"use client";

import React from "react";
import Shell from "@/components/Shell";
import { Camera, ShieldCheck } from "lucide-react";

export default function VerifyShop() {
    return (
        <Shell>
            <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
                <div className="text-center space-y-2">
                    <h1 className="text-3xl font-bold text-brand-primary">Verify Shop</h1>
                    <p className="text-brand-text/60">Prove your impact onchain.</p>
                </div>

                <div className="flex flex-col items-center justify-center">
                    <div className="relative group cursor-pointer">
                        <div className="absolute inset-0 bg-brand-primary/5 rounded-full blur-3xl group-hover:bg-brand-primary/10 transition-colors"></div>
                        <div className="relative w-64 h-64 bg-white rounded-full shadow-2xl border-4 border-white flex flex-col items-center justify-center gap-4 transition-transform group-hover:scale-105 active:scale-95">
                            <div className="w-24 h-24 bg-brand-accent/50 rounded-3xl flex items-center justify-center text-brand-primary">
                                <Camera size={48} />
                            </div>
                            <span className="font-bold text-brand-text/40 uppercase tracking-widest text-xs">
                                Tap to upload
                            </span>
                        </div>
                    </div>
                </div>

                <div className="space-y-6">
                    <p className="text-center text-brand-text/60 max-w-[240px] mx-auto text-sm leading-relaxed">
                        Upload your receipt to verify your zero-waste grocery run and earn badges.
                    </p>

                    <button className="w-full bg-brand-primary text-white py-5 px-8 rounded-2xl font-bold text-xl shadow-xl hover:bg-brand-secondary transition-all active:scale-95 flex items-center justify-center gap-3">
                        <ShieldCheck size={24} />
                        Scan Receipt
                    </button>
                </div>
            </div>
        </Shell>
    );
}

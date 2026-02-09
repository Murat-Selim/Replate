'use client';

import BadgeMint from './BadgeMint';
import { useAccount } from 'wagmi';

export default function ImpactDashboard() {
    const { address } = useAccount();
    const streak = 3;
    const xp = 450;
    const potentialSavings = 12.5;

    return (
        <div className="animate-fadeIn space-y-12 pb-12">
            <div className="text-center space-y-2 pt-6">
                <h2 className="text-4xl font-extrabold text-primary tracking-tight">Your Impact</h2>
                <p className="text-sm font-medium text-text-muted">Proudly Onchain on Base</p>
            </div>

            {/* Main Streak Section */}
            <div className="flex flex-col items-center justify-center py-10 bg-white shadow-2xl rounded-[50px] border-8 border-primary/5 relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
                    <span className="text-9xl">🔥</span>
                </div>
                <span className="text-xs font-black uppercase tracking-[0.2em] text-primary opacity-40 mb-2">Current Streak</span>
                <span className="text-[120px] font-black text-primary leading-none tabular-nums select-none">
                    {streak}
                </span>
                <span className="text-sm font-bold text-text-muted mt-2">Verified Shop Streak</span>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-6">
                <div className="bg-white p-8 rounded-[40px] text-center shadow-sm border border-primary/5">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-primary opacity-40">Total XP</span>
                    <div className="text-3xl font-black text-primary mt-1 tabular-nums">{xp}</div>
                </div>

                <div className="bg-white p-8 rounded-[40px] text-center shadow-sm border border-primary/5">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-primary opacity-40">CO2 Saved</span>
                    <div className="text-3xl font-black text-primary mt-1 tabular-nums">{potentialSavings}kg</div>
                </div>
            </div>

            {/* Badge Claim Section */}
            <div className="space-y-6">
                <div className="flex justify-between items-center px-4">
                    <h3 className="text-xs font-black uppercase tracking-widest text-primary opacity-40">Impact Badges</h3>
                    <span className="text-xs font-bold text-primary opacity-60">View All ➔</span>
                </div>

                <div className="w-full">
                    {address ? (
                        <div className="space-y-4">
                            <BadgeMint userAddress={address} />
                        </div>
                    ) : (
                        <div className="p-6 bg-primary/5 rounded-3xl text-center text-xs font-bold text-primary opacity-50 uppercase tracking-widest">
                            Connect Wallet to Claim
                        </div>
                    )}
                </div>
            </div>

            <button
                className="btn-primary w-full shadow-2xl flex items-center justify-center gap-3"
            >
                <span>Share to Farcaster</span>
                <span className="opacity-50">↗</span>
            </button>
        </div>
    );
}

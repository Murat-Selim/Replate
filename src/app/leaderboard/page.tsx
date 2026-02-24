"use client";

import React from "react";
import Shell from "@/components/Shell";
import { Trophy, Medal, Award } from "lucide-react";

const leaders = [
    { id: 1, name: "Vitalik.eth", co2: "45.2kg", xp: "2400", avatar: "👤", active: true },
    { id: 2, name: "BaseUser1", co2: "32.1kg", xp: "1850", avatar: "👤", active: false },
    { id: 3, name: "EcoWarrior", co2: "21.5kg", xp: "1200", avatar: "👤", active: false },
    { id: 4, name: "ZeroWasteFan", co2: "15.0kg", xp: "950", avatar: "👤", active: false },
    { id: 5, name: "PlanetSaver", co2: "12.8kg", xp: "800", avatar: "👤", active: false },
];

export default function Leaderboard() {
    return (
        <Shell>
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                <div className="text-center space-y-2">
                    <h1 className="text-3xl font-bold text-brand-primary">Leaderboard</h1>
                    <p className="text-brand-text/60">Top waste-preventers on Base</p>
                </div>

                <div className="space-y-3">
                    {leaders.map((user, index) => (
                        <div
                            key={user.id}
                            className={`flex items-center justify-between p-4 rounded-3xl transition-all ${user.active
                                    ? "bg-brand-primary text-white shadow-lg scale-[1.02]"
                                    : "bg-white border border-brand-accent/20"
                                }`}
                        >
                            <div className="flex items-center gap-4">
                                <span className={`w-8 text-center font-black text-lg ${user.active ? "text-white/50" : "text-brand-text/20"}`}>
                                    {user.id}
                                </span>
                                <div className={`w-12 h-12 rounded-full flex items-center justify-center text-2xl ${user.active ? "bg-white/20" : "bg-brand-accent"}`}>
                                    {user.avatar}
                                </div>
                                <div>
                                    <h3 className="font-bold">{user.name}</h3>
                                    <p className={`text-xs ${user.active ? "text-white/60" : "text-brand-text/40"}`}>
                                        {user.co2} CO2 SAVED
                                    </p>
                                </div>
                            </div>
                            <div className="text-right">
                                <span className="font-black text-xl">{user.xp}</span>
                                <p className={`text-[10px] font-bold uppercase tracking-widest ${user.active ? "text-white/40" : "text-brand-text/20"}`}>
                                    XP
                                </p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </Shell>
    );
}

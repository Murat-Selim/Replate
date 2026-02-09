'use client';

import { useState } from 'react';

export default function SmartAssistant() {
  const [householdSize, setHouseholdSize] = useState(2);
  const [duration, setDuration] = useState(7); // days

  return (
    <div className="animate-fadeIn space-y-12 pb-12">
      <div className="text-center space-y-2 pt-6">
        <h2 className="text-4xl font-extrabold text-primary tracking-tight">Smart Shop</h2>
        <p className="text-sm font-medium text-text-muted">Buy just enough, waste nothing.</p>
      </div>

      <div className="space-y-6">
        {/* Household Size Selector */}
        <div className="flex flex-col items-center gap-4 bg-white/40 p-10 rounded-3xl border border-primary/5 shadow-sm">
          <span className="text-sm font-bold uppercase tracking-widest text-primary opacity-50">Household Size</span>
          <div className="flex items-center gap-8">
            <button
              onClick={() => setHouseholdSize(Math.max(1, householdSize - 1))}
              className="w-14 h-14 rounded-full bg-primary text-white flex items-center justify-center text-3xl font-bold hover:shadow-lg active:scale-95 transition-all"
            >−</button>
            <span className="text-6xl font-black tabular-nums text-primary">{householdSize}</span>
            <button
              onClick={() => setHouseholdSize(householdSize + 1)}
              className="w-14 h-14 rounded-full bg-primary text-white flex items-center justify-center text-3xl font-bold hover:shadow-lg active:scale-95 transition-all"
            >+</button>
          </div>
        </div>

        {/* Duration Selector */}
        <div className="flex flex-col items-center gap-4 bg-white/40 p-10 rounded-3xl border border-primary/5 shadow-sm">
          <span className="text-sm font-bold uppercase tracking-widest text-primary opacity-50">Shopping Duration</span>
          <div className="flex items-center gap-8">
            <button
              onClick={() => setDuration(Math.max(1, duration - 1))}
              className="w-14 h-14 rounded-full bg-primary text-white flex items-center justify-center text-3xl font-bold hover:shadow-lg active:scale-95 transition-all"
            >−</button>
            <span className="text-6xl font-black tabular-nums text-primary">{duration} <span className="text-2xl opacity-40">days</span></span>
            <button
              onClick={() => setDuration(duration + 1)}
              className="w-14 h-14 rounded-full bg-primary text-white flex items-center justify-center text-3xl font-bold hover:shadow-lg active:scale-95 transition-all"
            >+</button>
          </div>
        </div>
      </div>

      {/* Action Button */}
      <div className="pt-4 text-center">
        <button
          className="btn-primary w-full shadow-2xl flex items-center justify-center gap-3"
        >
          <span className="text-2xl">🥗</span>
          Generate Smart List
        </button>
      </div>

      {/* Insight Section */}
      <div className="p-8 bg-primary/5 rounded-[40px] text-center">
        <p className="text-sm text-primary font-bold italic leading-relaxed">
          &quot;Planning for {duration} days will save approximately 2.4kg of food waste for a household of {householdSize}.&quot;
        </p>
      </div>
    </div>
  );
}

"use client";

import Link from "next/link";
import Shell from "@/components/Shell";

export default function Home() {
  return (
    <Shell>
      <div className="flex flex-col items-center justify-center min-h-[70vh] text-center space-y-12 animate-in fade-in slide-in-from-bottom-6 duration-1000">

        {/* Exact Replica of the Shield-Plate Icon */}
        <div className="relative w-64 h-64 flex items-center justify-center">
          {/* Subtle Outer Glow */}
          <div className="absolute inset-0 bg-brand-primary/10 rounded-full blur-[60px]"></div>

          {/* The Circular Gradient Container */}
          <div className="relative w-56 h-56 rounded-full bg-gradient-to-br from-[#2a6850] via-[#1e4d3a] to-[#0d261c] flex items-center justify-center shadow-2xl overflow-hidden">
            {/* The Specific Shield-Plate SVG Path */}
            <div className="relative text-[#0a1f16] opacity-90">
              <svg viewBox="0 0 100 100" className="w-32 h-32">
                <path
                  d="M50 25 C50 25 55 35 72 42 C72 55 65 75 50 75 C35 75 28 55 28 42 C45 35 50 25 50 25 Z"
                  fill="currentColor"
                />
              </svg>
            </div>
          </div>
        </div>

        {/* Text Section */}
        <div className="space-y-6">
          <h1 className="text-7xl font-black tracking-tight text-brand-primary">
            Replate
          </h1>
          <div className="space-y-1">
            <p className="text-2xl text-brand-text/90 font-bold tracking-tight">
              Shop smart. Nourish well.
            </p>
            <p className="text-2xl text-brand-primary font-black tracking-tight">
              Earn onchain.
            </p>
          </div>
        </div>

        <Link
          href="/shop"
          className="w-full max-w-xs bg-brand-primary text-white py-5 px-10 rounded-[32px] font-black text-xl shadow-[0_20px_40px_rgba(26,62,47,0.3)] hover:bg-brand-secondary transition-all active:scale-95 flex items-center justify-center gap-3"
        >
          Start Shopping
        </Link>
      </div>
    </Shell>
  );
}

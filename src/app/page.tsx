"use client";

import Link from "next/link";
import Image from "next/image";
import Shell from "@/components/Shell";

export default function Home() {
  return (
    <Shell>
      <div className="flex flex-col items-center justify-center min-h-[70vh] text-center space-y-6 animate-in fade-in slide-in-from-bottom-6 duration-1000">

        {/* Logo Image */}
        <div className="relative w-64 h-64 flex items-center justify-center">
          {/* Subtle Outer Glow */}
          <div className="absolute inset-0 bg-brand-primary/10 rounded-full blur-[60px]"></div>

          {/* The Logo Image */}
          <div className="relative w-56 h-56 flex items-center justify-center overflow-hidden">
            <Image
              src="/replate-logo.png"
              alt="Replate Logo"
              width={224}
              height={224}
              className="object-contain"
              priority
            />
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

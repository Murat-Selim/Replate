import Link from "next/link";
import Shell from "@/components/Shell";
import { Leaf } from "lucide-react";

export default function Home() {
  return (
    <Shell>
      <div className="flex flex-col items-center justify-center min-h-[70vh] text-center space-y-12 animate-in fade-in slide-in-from-bottom-6 duration-1000">
        {/* Logo/Icon Container */}
        <div className="relative w-56 h-56">
          <div className="absolute inset-0 bg-brand-primary/15 rounded-full blur-3xl animate-pulse"></div>
          <div className="relative w-full h-full bg-gradient-to-br from-brand-primary to-brand-secondary rounded-full flex items-center justify-center shadow-[0_32px_64px_rgba(26,62,47,0.4)] border-8 border-white">
            <div className="w-32 h-32 bg-white/20 rounded-full backdrop-blur-xl flex items-center justify-center overflow-hidden border border-white/30">
              <Leaf size={80} className="text-white fill-white/10" strokeWidth={1.5} />
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <h1 className="text-7xl font-black tracking-tight text-brand-primary">
            Replate
          </h1>
          <div className="space-y-2">
            <p className="text-2xl text-brand-text/90 font-bold leading-tight tracking-tight">
              Shop smart.
            </p>
            <p className="text-2xl text-brand-text/90 font-bold leading-tight tracking-tight">
              Save the planet.
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

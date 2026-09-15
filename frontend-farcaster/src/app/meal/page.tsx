"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, CheckCircle2, ImagePlus, Loader2, Sparkles } from "lucide-react";
import Shell from "@/components/Shell";
import { getApiUrl } from "@/lib/api";
import { compressImage } from "@/lib/image";
import { track } from "@vercel/analytics";

interface MealResult {
    detectedLabels: { label: string; confidence: number }[];
    components: string[];
    balanceScore: number;
    confidence: number;
    insight: string;
    recommendation: string;
}

export default function MealPage() {
    const [image, setImage] = useState<string | null>(null);
    const [result, setResult] = useState<MealResult | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        setError(null);
        setResult(null);
        try {
            setImage(await compressImage(file, 1600, 1600, 0.82));
        } catch {
            const reader = new FileReader();
            reader.onload = () => setImage(String(reader.result));
            reader.readAsDataURL(file);
        }
    };

    const analyze = async () => {
        if (!image) return setError("Add a meal photo first.");
        track("meal_analysis_started");
        setLoading(true);
        setError(null);
        try {
            const response = await fetch(getApiUrl("/api/analyze-meal"), {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ imageBase64: image.split(",")[1] || image }),
            });
            const data = await response.json();
            if (!response.ok || !data.success) throw new Error(data.error || "Meal analysis failed.");
            setResult(data.data);
            track("meal_analysis_completed", { balance_score: Number(data.data.balanceScore) });
        } catch (err) {
            setError(err instanceof Error ? err.message : "Meal analysis failed.");
        } finally {
            setLoading(false);
        }
    };

    const shareResult = async () => {
        if (!result) return;
        track("meal_result_shared");
        const share = { title: "My Replate Meal Insight", text: `My Replate meal balance signal is ${result.balanceScore}/100. ${result.recommendation}`, url: window.location.href };
        try {
            if (navigator.share) await navigator.share(share);
            else await navigator.clipboard.writeText(`${share.text} ${share.url}`);
        } catch { /* User cancelled sharing. */ }
    };

    return (
        <Shell>
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                <div className="space-y-2">
                    <p className="text-[11px] font-black uppercase tracking-[0.25em] text-[#22D97A] font-heading">Meal Intelligence</p>
                    <h1 className="text-3xl font-black uppercase tracking-wide text-white font-heading">Make your meal easier to improve.</h1>
                    <p className="text-sm leading-6 text-[#A6B0B5]">Add a meal photo for an estimated balance signal and one practical recommendation. This is visual guidance - not an exact calorie count or medical advice.</p>
                </div>

                <section className="space-y-5">
                    <div className="glass-card rounded-[28px] border border-[#22D97A]/15 p-5">
                        <label htmlFor="meal-photo" className="relative flex aspect-square cursor-pointer flex-col items-center justify-center overflow-hidden rounded-3xl border-2 border-dashed border-[#22D97A]/25 bg-[#22D97A]/5 transition hover:border-[#22D97A]/50">
                            {image ? <Image src={image} alt="Meal preview" fill unoptimized className="object-cover" /> : <><ImagePlus size={42} className="text-[#22D97A]" /><span className="mt-4 font-black text-white">Take or choose a meal photo</span><span className="mt-1 text-center text-sm text-[#A6B0B5]">Your photo is used for this analysis only.</span></>}
                        </label>
                        <input id="meal-photo" type="file" accept="image/*" capture="environment" onChange={handleFile} className="sr-only" />
                        <button onClick={analyze} disabled={!image || loading} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#22D97A] px-5 py-4 font-black uppercase tracking-wider text-[#0B1114] transition hover:shadow-[0_0_25px_rgba(34,217,122,0.35)] disabled:cursor-not-allowed disabled:opacity-40">{loading ? <Loader2 size={19} className="animate-spin" /> : <Sparkles size={19} />} Analyze Meal</button>
                        {error && <p role="alert" className="mt-4 rounded-xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm font-bold text-red-200">{error}</p>}
                    </div>

                    <div className="glass-card rounded-[28px] border border-[#22D97A]/15 p-6">
                        {result ? <div className="space-y-5"><div className="flex items-end gap-3"><span className="text-7xl font-black text-[#22D97A]">{result.balanceScore}</span><span className="pb-2 text-xs font-black uppercase tracking-wider text-[#A6B0B5]">/ 100<br />Balance signal</span></div><div className="flex items-center gap-2 text-sm font-bold text-[#22D97A]"><CheckCircle2 size={17} />{result.insight}</div><div><p className="mb-2 text-[10px] font-black uppercase tracking-[0.18em] text-[#A6B0B5]">Detected components</p><div className="flex flex-wrap gap-2">{(result.components.length ? result.components : result.detectedLabels.map((item) => item.label)).map((component) => <span key={component} className="rounded-full border border-[#22D97A]/20 bg-[#22D97A]/5 px-3 py-1.5 text-sm font-bold capitalize text-white/85">{component.replaceAll("_", " ")}</span>)}</div></div><div className="rounded-2xl border border-[#22D97A]/15 bg-[#22D97A]/5 p-4"><p className="text-[10px] font-black uppercase tracking-wider text-[#22D97A]">Next step</p><p className="mt-2 text-sm leading-6 text-white/85">{result.recommendation}</p></div><p className="text-xs text-[#A6B0B5]">Visual confidence: {Math.round(result.confidence * 100)}%. Replate does not claim exact calories from a photo.</p><button onClick={shareResult} className="inline-flex items-center justify-center rounded-full border border-[#22D97A]/25 px-4 py-3 text-xs font-black uppercase tracking-wider text-[#22D97A] hover:bg-[#22D97A]/10">Share Meal Result</button></div> : <div className="flex min-h-64 flex-col justify-center"><Sparkles size={32} className="text-[#22D97A]" /><h2 className="mt-5 text-2xl font-black text-white font-heading">Insight in seconds</h2><p className="mt-2 text-sm leading-7 text-[#A6B0B5]">Replate looks for visible food groups, highlights balance and gives you a practical improvement to try next time.</p></div>}
                    </div>
                </section>

                <div className="flex flex-wrap gap-4 text-xs font-black uppercase tracking-wider text-[#A6B0B5]"><Link href="/verify-receipt" className="inline-flex items-center gap-2 hover:text-white">Analyze a full receipt <ArrowRight size={15} /></Link><Link href="/profile" className="inline-flex items-center gap-2 hover:text-white">Track progress <ArrowRight size={15} /></Link></div>
            </div>
        </Shell>
    );
}

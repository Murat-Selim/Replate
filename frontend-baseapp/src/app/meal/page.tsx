"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
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
            <div className="mx-auto max-w-4xl space-y-8 animate-fade-in-up">
                <div className="space-y-2">
                    <p className="text-xs font-black uppercase tracking-[0.2em] text-[#00E36E]">Meal Intelligence</p>
                    <h1 className="text-3xl font-black text-white sm:text-4xl">Make your meal easier to improve.</h1>
                    <p className="max-w-2xl text-[#8c9790]">Add a meal photo to get an estimated balance signal and one practical recommendation. This is visual guidance - not an exact calorie count or medical advice.</p>
                </div>

                <section className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
                    <div className="rounded-3xl border border-[#00E36E]/15 bg-[#0c1310]/90 p-6 sm:p-8">
                        <label htmlFor="meal-photo" className="relative flex aspect-square cursor-pointer flex-col items-center justify-center overflow-hidden rounded-3xl border-2 border-dashed border-[#00E36E]/25 bg-[#00E36E]/5 transition hover:border-[#00E36E]/50">
                            {image ? <Image src={image} alt="Meal preview" fill unoptimized className="object-cover" /> : <><ImagePlus size={42} className="text-[#00E36E]" /><span className="mt-4 font-black text-white">Take or choose a meal photo</span><span className="mt-1 text-sm text-[#8c9790]">Your photo is used for this analysis only.</span></>}
                        </label>
                        <input id="meal-photo" type="file" accept="image/*" capture="environment" onChange={handleFile} className="sr-only" />
                        <button onClick={analyze} disabled={!image || loading} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#00E36E] px-5 py-4 font-black text-[#050806] transition hover:bg-[#00FF66] disabled:cursor-not-allowed disabled:opacity-40">{loading ? <Loader2 size={19} className="animate-spin" /> : <Sparkles size={19} />} Analyze Meal</button>
                        {error && <p role="alert" className="mt-4 rounded-xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm font-bold text-red-200">{error}</p>}
                    </div>

                    <div className="rounded-3xl border border-[#00E36E]/15 bg-[#0c1310]/90 p-6 sm:p-8">
                        {result ? <div className="space-y-6"><div className="flex items-end gap-3"><span className="text-7xl font-black text-[#00E36E]">{result.balanceScore}</span><span className="pb-2 text-sm font-black uppercase tracking-wider text-[#8c9790]">/ 100<br />Balance signal</span></div><div className="flex items-center gap-2 text-sm font-bold text-[#00E36E]"><CheckCircle2 size={17} />{result.insight}</div><div><p className="mb-2 text-xs font-black uppercase tracking-[0.18em] text-[#8c9790]">Detected components</p><div className="flex flex-wrap gap-2">{(result.components.length ? result.components : result.detectedLabels.map((item) => item.label)).map((component) => <span key={component} className="rounded-full border border-[#00E36E]/20 bg-[#00E36E]/5 px-3 py-1.5 text-sm font-bold capitalize text-white/85">{component.replaceAll("_", " ")}</span>)}</div></div><div className="rounded-2xl border border-[#00E36E]/15 bg-[#00E36E]/5 p-4"><p className="text-xs font-black uppercase tracking-wider text-[#00E36E]">Next step</p><p className="mt-2 text-sm leading-6 text-white/85">{result.recommendation}</p></div><p className="text-xs text-[#8c9790]">Visual confidence: {Math.round(result.confidence * 100)}%. Replate does not claim exact calories from a photo.</p><button onClick={shareResult} className="inline-flex items-center justify-center rounded-2xl border border-[#00E36E]/25 px-4 py-3 text-sm font-black text-[#00E36E] hover:bg-[#00E36E]/10">Share Meal Result</button></div> : <div className="flex h-full min-h-72 flex-col justify-center"><Sparkles size={32} className="text-[#00E36E]" /><h2 className="mt-5 text-2xl font-black text-white">Insight in seconds</h2><p className="mt-2 leading-7 text-[#8c9790]">Replate looks for visible food groups, highlights balance and gives you a practical improvement to try next time.</p></div>}
                    </div>
                </section>

                <div className="flex flex-wrap gap-4 text-sm font-bold text-[#8c9790]"><Link href="/verify-receipt" className="inline-flex items-center gap-2 hover:text-white">Analyze a full grocery receipt <ArrowRight size={15} /></Link><Link href="/profile" className="inline-flex items-center gap-2 hover:text-white">Track progress <ArrowRight size={15} /></Link></div>
            </div>
        </Shell>
    );
}

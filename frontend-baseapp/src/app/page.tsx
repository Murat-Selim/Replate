import Link from "next/link";
import { ArrowRight, Camera, CheckCircle2, CircleDollarSign, History, ShieldCheck, Utensils } from "lucide-react";
import Shell from "@/components/Shell";

const steps = [
    ["01", "Scan", "Analyze a meal photo or a full grocery receipt."],
    ["02", "Insight", "See a clear health and nutrition signal in seconds."],
    ["03", "Improve", "Get one practical next step for your choices."],
    ["04", "Track", "Save meaningful progress and build your history."],
];

const features = [
    { icon: ShieldCheck, title: "Private by default", text: "Raw personal data stays private; only necessary proof is shared." },
    { icon: CircleDollarSign, title: "Why Base?", text: "Base verifies ownership and progress when it matters." },
    { icon: History, title: "History is the moat", text: "Repeated choices improve the usefulness of Replate Intelligence." },
];

export default function Home() {
    return (
        <Shell>
            <div className="space-y-14 pb-10">
                <section className="grid items-center gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:gap-16 lg:py-10">
                    <div className="space-y-6 animate-fade-in-up">
                        <p className="text-xs font-black uppercase tracking-[0.25em] text-[#00E36E]">Food Intelligence</p>
                        <h1 className="max-w-3xl text-5xl font-black leading-[1.03] tracking-tight text-white sm:text-6xl">Understand what you eat.</h1>
                        <p className="max-w-xl text-lg leading-8 text-[#8c9790]">Turn everyday food choices into simple, useful insights. Start with one photo and get a better next choice in under 30 seconds.</p>
                        <div className="flex flex-col gap-3 sm:flex-row">
                            <Link href="/meal" className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#00E36E] px-6 py-4 text-base font-black text-[#050806] shadow-[0_0_24px_rgba(0,227,110,0.25)] transition hover:bg-[#00FF66]"><Utensils size={20} />Analyze Meal<ArrowRight size={18} /></Link>
                            <Link href="/verify-receipt" className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[#00E36E]/25 bg-[#00E36E]/5 px-6 py-4 text-base font-black text-[#00E36E] transition hover:bg-[#00E36E]/10"><Camera size={20} />Verify Receipt</Link>
                        </div>
                    </div>
                    <div className="relative animate-fade-in-up-delay-1"><div className="absolute inset-10 rounded-full bg-[#00E36E]/10 blur-[90px]" /><div className="relative rounded-[2rem] border border-[#00E36E]/20 bg-[#0c1310]/90 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.45)] sm:p-7"><div className="flex items-center justify-between border-b border-white/10 pb-5"><div><p className="text-xs font-black uppercase tracking-[0.18em] text-[#8c9790]">Your next choice</p><p className="mt-1 text-xl font-black text-white">Make insight actionable.</p></div><CheckCircle2 className="text-[#00E36E]" size={28} /></div><div className="space-y-3 py-6">{["Health signal", "Nutrition balance", "Practical recommendation"].map((item) => <div key={item} className="flex items-center gap-3 rounded-2xl border border-white/5 bg-white/[0.03] p-4"><div className="h-2.5 w-2.5 rounded-full bg-[#00E36E] shadow-[0_0_12px_#00E36E]" /><span className="text-sm font-bold text-white/85">{item}</span></div>)}</div><div className="rounded-2xl border border-[#00E36E]/15 bg-[#00E36E]/5 p-4 text-sm leading-6 text-[#8c9790]">Replate keeps personal data private and uses Base for meaningful proof of progress.</div></div></div>
                </section>

                <section className="grid gap-4 md:grid-cols-2">
                    <Link href="/meal" className="group rounded-3xl border border-[#00E36E]/15 bg-[#0c1310]/90 p-6 transition hover:-translate-y-1 hover:border-[#00E36E]/35"><div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#00E36E]/10 text-[#00E36E]"><Utensils size={24} /></div><h2 className="text-2xl font-black text-white">Meal Intelligence</h2><p className="mt-2 max-w-md leading-7 text-[#8c9790]">Upload a meal photo for a visual balance estimate and one practical recommendation—without pretending calories are exact.</p><span className="mt-5 inline-flex items-center gap-2 text-sm font-black text-[#00E36E]">Analyze a meal <ArrowRight size={16} className="transition group-hover:translate-x-1" /></span></Link>
                    <Link href="/verify-receipt" className="group rounded-3xl border border-[#00E36E]/15 bg-[#0c1310]/90 p-6 transition hover:-translate-y-1 hover:border-[#00E36E]/35"><div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#00E36E]/10 text-[#00E36E]"><Camera size={24} /></div><h2 className="text-2xl font-black text-white">Basket Intelligence</h2><p className="mt-2 max-w-md leading-7 text-[#8c9790]">Verify a grocery receipt to understand your basket health, improve your next shop and keep a verifiable record.</p><span className="mt-5 inline-flex items-center gap-2 text-sm font-black text-[#00E36E]">Verify a receipt <ArrowRight size={16} className="transition group-hover:translate-x-1" /></span></Link>
                </section>

                <section className="rounded-3xl border border-[#00E36E]/15 bg-[#0c1310]/70 p-6 sm:p-8"><div className="mb-7 flex flex-col justify-between gap-3 sm:flex-row sm:items-end"><div><p className="text-xs font-black uppercase tracking-[0.2em] text-[#00E36E]">Consumer loop</p><h2 className="mt-2 text-2xl font-black text-white">Small choices, visible progress.</h2></div><Link href="/profile" className="inline-flex items-center gap-2 text-sm font-bold text-[#8c9790] hover:text-white">View Weekly Replate Score <ArrowRight size={15} /></Link></div><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{steps.map(([number, title, text]) => <div key={number} className="rounded-2xl border border-white/5 bg-white/[0.02] p-4"><span className="text-xs font-black text-[#00E36E]">{number}</span><h3 className="mt-3 font-black text-white">{title}</h3><p className="mt-1 text-sm leading-6 text-[#8c9790]">{text}</p></div>)}</div></section>

                <section className="grid gap-4 md:grid-cols-3">{features.map(({ icon: Icon, title, text }) => <div key={title} className="rounded-2xl border border-white/5 bg-[#0c1310]/70 p-5"><Icon className="text-[#00E36E]" size={20} /><h3 className="mt-4 font-black text-white">{title}</h3><p className="mt-1 text-sm leading-6 text-[#8c9790]">{text}</p></div>)}</section>
            </div>
        </Shell>
    );
}

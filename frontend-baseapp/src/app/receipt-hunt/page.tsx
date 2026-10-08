import Link from "next/link";
import { ArrowRight, Camera, EyeOff, Gift, Lightbulb, ShieldCheck } from "lucide-react";
import Shell from "@/components/Shell";

const steps = [
    ["01", "Verify a grocery receipt", "Replate analyzes your basket and creates a private result."],
    ["02", "Add one observation", "Tell us what surprised you about your shopping habits."],
    ["03", "Share your card", "Post the generated card with #ReceiptHunt and tag @replateapp."],
];

export default function ReceiptHuntPage() {
    return (
        <Shell>
            <main className="space-y-8 pb-8" aria-labelledby="receipt-hunt-title">
                <section className="rounded-3xl border border-[#00E36E]/20 bg-[radial-gradient(ellipse_at_top_right,rgba(0,227,110,0.14),transparent_55%),#0c1310] p-6 sm:p-10">
                    <div className="flex flex-wrap items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-[#00E36E]">
                        <Lightbulb size={16} />
                        Weekly community challenge
                    </div>
                    <h1 id="receipt-hunt-title" className="mt-4 text-4xl font-black tracking-tight text-white sm:text-6xl">Receipt Hunt</h1>
                    <p className="mt-3 max-w-2xl text-lg leading-8 text-[#8c9790]">Don’t share your receipt. Share what it revealed.</p>

                    <article className="mt-8 rounded-3xl border border-[#00E36E]/20 bg-black/20 p-5 sm:p-7">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#00E36E]">This week · RECEİPT HUNT #01</p>
                            <span className="rounded-full border border-white/10 px-3 py-1 text-xs font-bold text-white/70">Open challenge</span>
                        </div>
                        <h2 className="mt-5 max-w-2xl text-2xl font-black leading-tight text-white sm:text-3xl">Which category did you spend more on than you expected?</h2>
                        <p className="mt-3 max-w-2xl text-sm leading-7 text-[#8c9790]">Submit your receipt on Replate, then run the Receipt Spending Breakdown analysis (0.05 USDC) to find your top category. Add one surprising observation and share your privacy-safe card.</p>
                        <Link href="/verify-receipt?challenge=receipt-hunt-01" className="mt-6 inline-flex items-center justify-center gap-2 rounded-2xl bg-[#00E36E] px-5 py-3.5 text-sm font-black text-[#050806] transition hover:bg-[#00FF66]">
                            <Camera size={18} />
                            Join this week’s Hunt
                            <ArrowRight size={17} />
                        </Link>
                    </article>

                    <div className="mt-5 flex items-center gap-3 rounded-2xl border border-[#00E36E]/10 bg-[#00E36E]/5 p-4">
                        <Gift className="shrink-0 text-[#00E36E]" size={22} />
                        <div className="text-sm leading-6 text-white">
                            <p><span className="font-black">Weekly reward: $5 USDC worth of AAPLc</span><span className="text-[#8c9790]"> (tokenized Apple stock on Base), valued at payout time.</span></p>
                            <p className="mt-1 text-xs leading-5 text-[#8c9790]">The team selects one winner, confirms issuer eligibility and a Base wallet, then manually sends the reward and features their entry. AAPLc is offered only in eligible jurisdictions.</p>
                        </div>
                    </div>
                </section>

                <section className="grid gap-6 md:grid-cols-[1fr_0.9fr]">
                    <div className="rounded-3xl border border-white/10 bg-[#0c1310]/80 p-6">
                        <h2 className="text-xl font-black text-white">How to enter</h2>
                        <ol className="mt-5 space-y-4">
                            {steps.map(([number, title, description]) => (
                                <li key={number} className="flex gap-4">
                                    <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[#00E36E]/10 text-xs font-black text-[#00E36E]">{number}</span>
                                    <div>
                                        <h3 className="font-bold text-white">{title}</h3>
                                        <p className="mt-1 text-sm leading-6 text-[#8c9790]">{description}</p>
                                    </div>
                                </li>
                            ))}
                        </ol>
                        <p className="mt-5 border-t border-white/10 pt-4 text-xs leading-5 text-[#8c9790]">Public posts using #ReceiptHunt and tagging @replateapp are reviewed by the Replate team each week. The most useful, specific, and creative observation gets the reward and spotlight.</p>
                    </div>

                    <aside className="rounded-3xl border border-[#00E36E]/15 bg-[#00E36E]/5 p-6">
                        <div className="flex items-center gap-2 text-[#00E36E]">
                            <ShieldCheck size={20} />
                            <h2 className="text-xl font-black">Your receipt stays private</h2>
                        </div>
                        <p className="mt-3 text-sm leading-7 text-[#8c9790]">The share card uses selected analysis results and your own observation. It never includes the receipt photo, store, transaction ID, wallet address, or payment details.</p>
                        <div className="mt-5 flex items-start gap-3 rounded-2xl border border-white/10 bg-black/20 p-4">
                            <EyeOff className="mt-0.5 shrink-0 text-[#00E36E]" size={18} />
                            <p className="text-xs leading-5 text-white/75">Only share the generated card. Never post a raw receipt, barcode, loyalty number, address, or other private information.</p>
                        </div>
                    </aside>
                </section>

                <section className="rounded-3xl border border-white/10 bg-[#0c1310]/80 p-6">
                    <h2 className="text-xl font-black text-white">The weekly rhythm</h2>
                    <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                        {[
                            ["Monday", "New challenge"],
                            ["Tue–Thu", "Community entries"],
                            ["Friday", "Top 3 shortlisted"],
                            ["Saturday", "Winner spotlight"],
                            ["Sunday", "What we learned"],
                        ].map(([day, activity]) => <div key={day} className="rounded-2xl border border-white/5 bg-white/[0.03] p-3"><p className="text-xs font-black text-[#00E36E]">{day}</p><p className="mt-1 text-sm font-semibold text-white/80">{activity}</p></div>)}
                    </div>
                </section>
            </main>
        </Shell>
    );
}

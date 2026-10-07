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
            <main className="space-y-6 pb-8" aria-labelledby="receipt-hunt-title">
                <section className="rounded-[28px] border border-[#22D97A]/20 bg-[radial-gradient(ellipse_at_top_right,rgba(34,217,122,0.14),transparent_55%),#131C20] p-5 sm:p-7">
                    <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-[#22D97A]">
                        <Lightbulb size={15} />
                        Weekly community challenge
                    </div>
                    <h1 id="receipt-hunt-title" className="mt-4 text-4xl font-black tracking-tight text-white font-heading">Receipt Hunt</h1>
                    <p className="mt-3 text-sm leading-7 text-[#A6B0B5]">Don’t share your receipt. Share what it revealed.</p>

                    <article className="mt-6 rounded-[24px] border border-[#22D97A]/20 bg-black/20 p-4 sm:p-5">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#22D97A]">This week · RECEİPT HUNT #01</p>
                            <span className="rounded-full border border-white/10 px-3 py-1 text-[10px] font-bold text-white/70">Open challenge</span>
                        </div>
                        <h2 className="mt-4 text-2xl font-black leading-tight text-white font-heading">Which category did you spend more on than you expected?</h2>
                        <p className="mt-3 text-xs leading-6 text-[#A6B0B5]">Verify a receipt, add one surprising observation, then share the privacy-safe card Replate creates from your analysis.</p>
                        <p className="mt-3 text-[10px] leading-5 text-[#A6B0B5]"><span className="font-bold text-white">Challenge API:</span> Receipt Spending Breakdown · GET /api/intelligence/spending/receipt/&#123;receiptId&#125; · one x402 call after verification · 0.05 USDC.</p>
                        <Link href="/verify-receipt?challenge=receipt-hunt-01" className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#22D97A] px-5 py-4 text-xs font-black uppercase tracking-wider text-[#0B1114] transition hover:brightness-110">
                            <Camera size={17} />
                            Join this week’s Hunt
                            <ArrowRight size={17} />
                        </Link>
                    </article>

                    <div className="mt-4 flex items-center gap-3 rounded-[20px] border border-[#22D97A]/10 bg-[#22D97A]/5 p-4">
                        <Gift className="shrink-0 text-[#22D97A]" size={20} />
                        <div className="text-xs leading-5 text-white">
                            <p><span className="font-black">Weekly reward: $5 USDC worth of AAPLc</span><span className="text-[#A6B0B5]"> (tokenized Apple stock on Base), valued at payout time.</span></p>
                            <p className="mt-1 text-[10px] leading-5 text-[#A6B0B5]">The team selects one winner, confirms issuer eligibility and a Base wallet, then manually sends the reward and features their entry. AAPLc is offered only in eligible jurisdictions.</p>
                        </div>
                    </div>
                </section>

                <section className="space-y-4">
                    <div className="rounded-[24px] border border-white/10 bg-[#131C20]/80 p-5">
                        <h2 className="text-lg font-black text-white font-heading">How to enter</h2>
                        <ol className="mt-4 space-y-4">
                            {steps.map(([number, title, description]) => (
                                <li key={number} className="flex gap-3">
                                    <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-[#22D97A]/10 text-[10px] font-black text-[#22D97A]">{number}</span>
                                    <div>
                                        <h3 className="text-xs font-bold text-white">{title}</h3>
                                        <p className="mt-1 text-[11px] leading-5 text-[#A6B0B5]">{description}</p>
                                    </div>
                                </li>
                            ))}
                        </ol>
                        <p className="mt-4 border-t border-white/10 pt-4 text-[10px] leading-5 text-[#A6B0B5]">Public posts using #ReceiptHunt and tagging @replateapp are reviewed by the Replate team each week. The most useful, specific, and creative observation gets the reward and spotlight.</p>
                    </div>

                    <aside className="rounded-[24px] border border-[#22D97A]/15 bg-[#22D97A]/5 p-5">
                        <div className="flex items-center gap-2 text-[#22D97A]">
                            <ShieldCheck size={18} />
                            <h2 className="text-lg font-black font-heading">Your receipt stays private</h2>
                        </div>
                        <p className="mt-3 text-xs leading-6 text-[#A6B0B5]">The share card uses selected analysis results and your own observation. It never includes the receipt photo, store, transaction ID, wallet address, or payment details.</p>
                        <div className="mt-4 flex items-start gap-3 rounded-[18px] border border-white/10 bg-black/20 p-3">
                            <EyeOff className="mt-0.5 shrink-0 text-[#22D97A]" size={17} />
                            <p className="text-[10px] leading-5 text-white/75">Only share the generated card. Never post a raw receipt, barcode, loyalty number, address, or other private information.</p>
                        </div>
                    </aside>
                </section>

                <section className="rounded-[24px] border border-white/10 bg-[#131C20]/80 p-5">
                    <h2 className="text-lg font-black text-white font-heading">The weekly rhythm</h2>
                    <div className="mt-4 space-y-2">
                        {[
                            ["Monday", "New challenge"],
                            ["Tue–Thu", "Community entries"],
                            ["Friday", "Top 3 shortlisted"],
                            ["Saturday", "Winner spotlight"],
                            ["Sunday", "What we learned"],
                        ].map(([day, activity]) => <div key={day} className="flex items-center justify-between gap-3 rounded-xl border border-white/5 bg-white/[0.03] px-3 py-2.5"><p className="text-[10px] font-black text-[#22D97A]">{day}</p><p className="text-right text-[10px] font-semibold text-white/80">{activity}</p></div>)}
                    </div>
                </section>
            </main>
        </Shell>
    );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, ExternalLink, Gift, LockKeyhole } from "lucide-react";

export default function ReceiptHuntTasks() {
    const [followComplete, setFollowComplete] = useState(false);
    const [engagementComplete, setEngagementComplete] = useState(false);
    const completed = Number(followComplete) + Number(engagementComplete);
    const unlocked = followComplete && engagementComplete;

    const tasks = [
        {
            title: "Follow @replateapp on X",
            description: "Follow Replate to keep up with this week’s Hunt.",
            complete: followComplete,
            simulate: () => setFollowComplete(true),
        },
        {
            title: "Like and repost the announcement",
            description: "Both a like and a repost are required. The announcement link will be added later.",
            complete: engagementComplete,
            simulate: () => setEngagementComplete(true),
        },
    ];

    return (
        <section id="hunt-tasks" aria-labelledby="hunt-tasks-title" className="scroll-mt-28 space-y-4 rounded-3xl border border-brand-primary/20 bg-brand-surface p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 id="hunt-tasks-title" className="text-xl font-black text-white">Unlock the Hunt task</h2>
                <span className="rounded-full border border-amber-300/30 bg-amber-300/10 px-3 py-1 text-xs font-bold text-amber-200">Demo mode</span>
            </div>
            <p className="text-sm leading-6 text-brand-text-muted">Try the two social checks below to unlock the Hunt task preview. These checks are simulated: they do not verify activity on X or establish prize eligibility.</p>
            <p role="status" aria-live="polite" className="text-xs font-bold text-brand-primary">{completed}/2 demo checks complete · {unlocked ? "Hunt task unlocked in demo" : "Hunt task locked"}</p>

            <ol className="space-y-3">
                {tasks.map((task, index) => (
                    <li key={task.title} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                        <div className="flex items-start gap-3">
                            <span aria-hidden="true" className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-brand-primary/10 text-xs font-black text-brand-primary">{task.complete ? <Check size={17} /> : `0${index + 1}`}</span>
                            <div className="min-w-0 flex-1">
                                <h3 className="text-sm font-bold text-white">{task.title}</h3>
                                <p className="mt-1 text-xs leading-5 text-brand-text-muted">{task.description}</p>
                                <div className="mt-3 flex flex-wrap items-center gap-3">
                                    {index === 0 && <a href="https://x.com/replateapp" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs font-bold text-brand-primary underline underline-offset-4">Open @replateapp <ExternalLink size={13} aria-hidden="true" /><span className="sr-only"> (opens in a new tab)</span></a>}
                                    <button type="button" disabled={task.complete} onClick={task.simulate} className="rounded-xl border border-brand-primary/30 px-3 py-2.5 text-xs font-bold text-brand-primary transition hover:bg-brand-primary/10 disabled:cursor-default disabled:opacity-60">{task.complete ? "Demo check complete" : index === 0 ? "Simulate follow verification" : "Simulate like + repost verification"}</button>
                                </div>
                            </div>
                        </div>
                    </li>
                ))}
                <li className={`rounded-2xl border p-4 ${unlocked ? "border-brand-primary/30 bg-brand-primary/5" : "border-white/10 bg-black/20"}`}>
                    <div className="flex items-start gap-3">
                        <span aria-hidden="true" className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-brand-primary/10 text-brand-primary">{unlocked ? <Gift size={17} /> : <LockKeyhole size={17} />}</span>
                        <div className="min-w-0 flex-1">
                            <h3 className="text-sm font-bold text-white">Hunt reward task</h3>
                            <p className="mt-1 text-xs leading-5 text-brand-text-muted">{unlocked ? "Demo unlocked: verify a grocery receipt, add your observation, and share your card. Week 01 offers $5 USDC worth of AAPLc to one selected winner." : "Complete both social checks to unlock the receipt challenge preview."}</p>
                            {unlocked ? (
                                <Link href="/verify-receipt?challenge=receipt-hunt-01" className="mt-3 inline-flex items-center justify-center gap-2 rounded-xl bg-brand-primary px-4 py-3 text-xs font-black text-black">Open receipt task <ArrowRight size={15} aria-hidden="true" /></Link>
                            ) : (
                                <button type="button" disabled className="mt-3 inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-3 text-xs font-bold text-white/50"><LockKeyhole size={14} aria-hidden="true" />Hunt task locked</button>
                            )}
                            {unlocked && <p className="mt-2 text-xs leading-5 text-brand-text-muted">The receipt flow is live; Spending Breakdown analysis costs 0.05 USDC. Demo checks do not award or claim a prize.</p>}
                        </div>
                    </div>
                </li>
            </ol>

            <button type="button" disabled={completed === 0} onClick={() => { setFollowComplete(false); setEngagementComplete(false); }} className="rounded-lg px-1 py-2 text-xs font-bold text-brand-text-muted underline underline-offset-4 hover:text-white disabled:opacity-40">Reset demo</button>
        </section>
    );
}

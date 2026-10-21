"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import Link from "next/link";
import { ArrowRight, Check, ExternalLink, Gift, LockKeyhole } from "lucide-react";
import { getHuntAnnouncementUrl, getHuntSnapshot, isHuntUnlocked, readHuntProgress, subscribeHuntProgress, updateHuntTask, type HuntTask } from "@/lib/receipt-hunt";

export default function ReceiptHuntTasks({ children }: { children?: ReactNode }) {
    const snapshot = useSyncExternalStore(subscribeHuntProgress, getHuntSnapshot, () => "");
    const progress = readHuntProgress(snapshot);
    const unlocked = isHuntUnlocked(progress);
    const completed = Number(progress.follow.verified) + Number(progress.engagement.verified);
    const announcementUrl = getHuntAnnouncementUrl();
    const tasks: { id: HuntTask; title: string; description: string; href: string; link: string }[] = [
        { id: "follow", title: "Follow @replateapp on X", description: "Follow Replate on X, then return here and press Verify.", href: "https://x.com/replateapp", link: "Follow on X" },
        { id: "engagement", title: "Like and repost the announcement", description: "Like and repost the Hunt announcement, then return here and press Verify.", href: announcementUrl || "https://x.com/replateapp", link: announcementUrl ? "Open announcement" : "Open Replate on X" },
    ];

    return (
        <section id="hunt-tasks" aria-labelledby="hunt-tasks-title" className="scroll-mt-28 space-y-4 rounded-3xl border border-brand-primary/20 bg-brand-surface p-5 sm:p-6">
            <h2 id="hunt-tasks-title" className="text-xl font-black text-white">Unlock the Hunt task</h2>
            <p className="text-sm leading-6 text-brand-text-muted">Complete both tasks on X and press Verify here to confirm. Replate checks X activity before awarding the prize.</p>
            <p role="status" className="text-xs font-bold text-brand-primary">{completed}/2 tasks verified · {unlocked ? "Hunt task unlocked" : "Hunt task locked"}</p>
            <ol className="space-y-3">
                {tasks.map((task, index) => (
                    <li key={task.id} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                        <div className="flex items-start gap-3">
                            <span aria-hidden="true" className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-brand-primary/10 text-xs font-black text-brand-primary">{progress[task.id].verified ? <Check size={17} /> : `0${index + 1}`}</span>
                            <div className="min-w-0 flex-1">
                                <h3 className="text-sm font-bold text-white">{task.title}</h3>
                                <p className="mt-1 text-xs leading-5 text-brand-text-muted">{task.description}</p>
                                <div className="mt-3 flex flex-wrap items-center gap-3">
                                    <a href={task.href} target="_blank" rel="noopener noreferrer" onClick={() => updateHuntTask(task.id, "open")} className="inline-flex items-center gap-1.5 text-xs font-bold text-brand-primary underline underline-offset-4">{task.link}<ExternalLink size={13} aria-hidden="true" /><span className="sr-only"> (opens in a new tab)</span></a>
                                    <button type="button" aria-label={`Verify ${task.id === "follow" ? "follow" : "like and repost"} task`} disabled={!progress[task.id].opened || progress[task.id].verified} onClick={() => updateHuntTask(task.id, "verify")} className="rounded-xl border border-brand-primary/30 px-4 py-2.5 text-xs font-bold text-brand-primary hover:bg-brand-primary/10 disabled:cursor-default disabled:opacity-50">{progress[task.id].verified ? "Verified" : "Verify"}</button>
                                </div>
                                {task.id === "engagement" && !announcementUrl && <p className="mt-2 text-xs text-brand-text-muted">The direct announcement link will be added here.</p>}
                            </div>
                        </div>
                    </li>
                ))}
            </ol>
            <div className={`rounded-2xl border p-4 ${unlocked ? "border-brand-primary/30 bg-brand-primary/5" : "border-white/10 bg-black/20"}`}>
                <h3 className="flex items-center gap-2 text-sm font-bold text-white">{unlocked ? <Gift size={17} /> : <LockKeyhole size={17} />}Hunt reward task</h3>
                <p className="mt-2 text-xs leading-5 text-brand-text-muted">{unlocked ? "Complete the receipt challenge to enter. Week 01 offers $5 USDC worth of AAPLc to one selected winner." : "Verify both X tasks to unlock the receipt challenge."}</p>
                {unlocked ? (children || <Link href="/verify-receipt?challenge=receipt-hunt-01" className="mt-3 inline-flex items-center gap-2 rounded-xl bg-brand-primary px-4 py-3 text-xs font-black text-black">Open receipt task<ArrowRight size={15} aria-hidden="true" /></Link>) : <button type="button" disabled className="mt-3 rounded-xl border border-white/10 px-4 py-3 text-xs font-bold text-white/50">Hunt task locked</button>}
                <p className="mt-2 text-xs leading-5 text-brand-text-muted">Spending Breakdown analysis costs 0.05 USDC. Verifying tasks confirms your participation; the team checks the selected winner on X before sending the prize.</p>
            </div>
        </section>
    );
}

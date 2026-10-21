"use client";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { useAccount, useSignMessage } from "wagmi";
import { ArrowRight, Check, ExternalLink, Gift, LockKeyhole } from "lucide-react";
import { compressImage } from "@/lib/image";
import { getHuntStatus, postHunt, signHuntRequest, type HuntStatus, type HuntTaskStatus } from "@/lib/receipt-hunt";

const labels: Record<HuntTaskStatus, string> = { not_submitted: "Evidence needed", pending: "Awaiting review", approved: "Approved", rejected: "Rejected · resubmit evidence" };

export default function ReceiptHuntTasks({ children }: { children?: ReactNode }) {
    const { address } = useAccount();
    const [loaded, setLoaded] = useState<{ wallet: string; status: HuntStatus } | null>(null);
    const [error, setError] = useState<{ wallet: string; message: string } | null>(null);
    const [refreshing, setRefreshing] = useState(false);
    const status = loaded && loaded.wallet === address ? loaded.status : null;
    const unlocked = status?.unlocked === true;
    const completed = Number(status?.followStatus === "approved") + Number(status?.engagementStatus === "approved");

    useEffect(() => {
        if (!address) return;
        const controller = new AbortController();
        getHuntStatus(address, controller.signal)
            .then(status => { if (!controller.signal.aborted) { setLoaded({ wallet: address, status }); setError(null); } })
            .catch(() => { if (!controller.signal.aborted) setError({ wallet: address, message: "Review status is unavailable. Try refreshing." }); });
        return () => controller.abort();
    }, [address]);

    async function refresh() {
        if (!address) return;
        setRefreshing(true); setError(null);
        try { setLoaded({ wallet: address, status: await getHuntStatus(address) }); }
        catch (error) { setError({ wallet: address, message: error instanceof Error ? error.message : "Status unavailable" }); }
        finally { setRefreshing(false); }
    }

    return (
        <section id="hunt-tasks" aria-labelledby="hunt-tasks-title" className="scroll-mt-28 space-y-4 rounded-3xl border border-brand-primary/20 bg-brand-surface p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 id="hunt-tasks-title" className="text-xl font-black text-white">Unlock the Hunt task</h2>
                <span className="rounded-full border border-amber-300/30 bg-amber-300/10 px-3 py-1 text-xs font-bold text-amber-200">Manual review</span>
            </div>
            <p className="text-sm leading-6 text-brand-text-muted">Submit evidence for both X tasks. The Replate team reviews each task; the Hunt unlocks only after both are approved.</p>
            {!address && <p className="text-sm font-bold text-brand-primary">Connect your wallet to submit evidence and see your approval status.</p>}
            <p role="status" className="text-xs font-bold text-brand-primary">{completed}/2 tasks approved · {unlocked ? "Hunt task unlocked" : "Hunt task locked"}</p>
            <ol className="space-y-3">
                {[
                    { title: "Follow @replateapp on X", description: "Upload a screenshot showing your X username and that you follow @replateapp.", status: status?.followStatus, href: "https://x.com/replateapp", link: "Open @replateapp" },
                    { title: "Like and repost the announcement", description: "Upload a screenshot showing your X username, the announcement, and both actions. A quote/reply link can help the reviewer confirm your account.", status: status?.engagementStatus, href: status?.announcementUrl, link: "Open announcement" },
                ].map((task, index) => (
                    <li key={task.title} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                        <div className="flex items-start gap-3">
                            <span aria-hidden="true" className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-brand-primary/10 text-xs font-black text-brand-primary">{task.status === "approved" ? <Check size={17} /> : `0${index + 1}`}</span>
                            <div className="min-w-0 flex-1">
                                <h3 className="text-sm font-bold text-white">{task.title}</h3>
                                <p className="mt-1 text-xs leading-5 text-brand-text-muted">{task.description}</p>
                                <p className="mt-2 text-xs font-bold text-brand-primary">{labels[task.status || "not_submitted"]}</p>
                                {task.href ? <a href={task.href} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-brand-primary underline underline-offset-4">{task.link}<ExternalLink size={13} aria-hidden="true" /><span className="sr-only"> (opens in a new tab)</span></a> : <p className="mt-2 text-xs text-brand-text-muted">Announcement link will be added here.</p>}
                            </div>
                        </div>
                    </li>
                ))}
            </ol>
            {address && <button type="button" disabled={refreshing} onClick={refresh} className="rounded-xl border border-brand-primary/30 px-3 py-2.5 text-xs font-bold text-brand-primary disabled:opacity-50">{refreshing ? "Checking..." : "Refresh approval status"}</button>}
            {error && error.wallet === address && <p role="alert" className="text-sm text-red-300">{error.message}</p>}
            {address && !status && !error && <p role="status" className="text-xs text-brand-text-muted">Loading review status...</p>}
            {address && status && !unlocked && <SubmissionForm key={address} wallet={address} revision={status.revision} onSubmitted={refresh} />}
            <div className={`rounded-2xl border p-4 ${unlocked ? "border-brand-primary/30 bg-brand-primary/5" : "border-white/10 bg-black/20"}`}>
                <h3 className="flex items-center gap-2 text-sm font-bold text-white">{unlocked ? <Gift size={17} /> : <LockKeyhole size={17} />}Hunt reward task</h3>
                <p className="mt-2 text-xs leading-5 text-brand-text-muted">{unlocked ? "Both social tasks are approved. Complete the receipt challenge to enter. Week 01 offers $5 USDC worth of AAPLc to one selected winner." : "Both tasks must receive administrator approval before this task opens."}</p>
                {unlocked ? (children || <Link href="/verify-receipt?challenge=receipt-hunt-01" className="mt-3 inline-flex items-center gap-2 rounded-xl bg-brand-primary px-4 py-3 text-xs font-black text-black">Open receipt task<ArrowRight size={15} aria-hidden="true" /></Link>) : <button type="button" disabled className="mt-3 rounded-xl border border-white/10 px-4 py-3 text-xs font-bold text-white/50">Hunt task locked</button>}
                <p className="mt-2 text-xs leading-5 text-brand-text-muted">Spending Breakdown analysis costs 0.05 USDC. Approval unlocks participation; one winner receives the manually awarded prize.</p>
            </div>
        </section>
    );
}

function SubmissionForm({ wallet, revision, onSubmitted }: { wallet: `0x${string}`; revision: number; onSubmitted: () => Promise<void> }) {
    const { signMessageAsync } = useSignMessage();
    const [username, setUsername] = useState("");
    const [repostUrl, setRepostUrl] = useState("");
    const [proofs, setProofs] = useState({ followProof: "", engagementProof: "" });
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");

    async function upload(file: File | undefined, field: keyof typeof proofs) {
        setError(""); setProofs(current => ({ ...current, [field]: "" }));
        if (!file) return;
        if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 10 * 1024 * 1024) { setError("Choose a JPG, PNG, or WebP screenshot smaller than 10 MB."); return; }
        setBusy(true);
        try { const proof = await compressImage(file, 1600, 1600, 0.8, 1400000); setProofs(current => ({ ...current, [field]: proof })); }
        catch { setError("Could not prepare the screenshot. Try a smaller image."); }
        finally { setBusy(false); }
    }

    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setBusy(true); setError(""); setNotice("");
        try {
            const data = { xUsername: username.trim().replace(/^@/, "").toLowerCase(), ...proofs, repostUrl: repostUrl.trim(), revision };
            const body = await signHuntRequest(wallet, "submit", data, message => signMessageAsync({ message, account: wallet }));
            await postHunt("/submit", body);
            setNotice("Evidence submitted. Both tasks are awaiting administrator review.");
            await onSubmitted();
        } catch (error) { setError(error instanceof Error ? error.message : "Submission failed"); }
        finally { setBusy(false); }
    }

    return (
        <form onSubmit={submit} className="space-y-4 rounded-2xl border border-white/10 bg-black/20 p-4">
            <h3 className="text-sm font-bold text-white">{revision ? "Replace evidence for review" : "Submit task evidence"}</h3>
            <p className="text-xs leading-5 text-brand-text-muted">Screenshots are visible to the Replate reviewer only. Include your X username and remove unrelated private information. Replacing evidence sends both tasks back for review.</p>
            <label className="block space-y-1 text-xs font-bold text-white"><span>X username</span><input required maxLength={16} pattern="@?[A-Za-z0-9_]{1,15}" autoComplete="off" value={username} disabled={busy} onChange={event => setUsername(event.target.value)} placeholder="@youraccount" className="block w-full rounded-xl border border-white/15 bg-black/20 px-3 py-3 outline-none focus:border-brand-primary" /></label>
            {(["followProof", "engagementProof"] as const).map(field => <label key={field} className="block space-y-2 text-xs font-bold text-white"><span>{field === "followProof" ? "Follow screenshot" : "Like + repost screenshot"}</span><input type="file" required disabled={busy} accept="image/jpeg,image/png,image/webp" onChange={event => upload(event.target.files?.[0], field)} className="block w-full text-xs text-brand-text-muted file:mr-3 file:rounded-lg file:border-0 file:bg-brand-primary/10 file:px-3 file:py-2 file:font-bold file:text-brand-primary" /><span className="block text-brand-text-muted">{proofs[field] ? "Screenshot ready" : "JPG, PNG, or WebP · maximum 10 MB"}</span></label>)}
            <label className="block space-y-1 text-xs font-bold text-white"><span>Your quote/reply link (optional)</span><input type="url" maxLength={250} value={repostUrl} disabled={busy} onChange={event => setRepostUrl(event.target.value)} placeholder="https://x.com/youraccount/status/..." className="block w-full rounded-xl border border-white/15 bg-black/20 px-3 py-3 outline-none focus:border-brand-primary" /></label>
            <button type="submit" disabled={busy || !proofs.followProof || !proofs.engagementProof} className="rounded-xl bg-brand-primary px-4 py-3 text-xs font-black text-black disabled:opacity-50">{busy ? "Preparing / signing..." : "Sign and send for review"}</button>
            <p className="text-xs leading-5 text-brand-text-muted">Signing confirms your wallet and evidence submission. It does not send a transaction or charge a fee.</p>
            {error && <p role="alert" className="text-xs text-red-300">{error}</p>}
            {notice && <p role="status" className="text-xs text-brand-primary">{notice}</p>}
        </form>
    );
}

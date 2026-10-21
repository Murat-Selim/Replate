"use client";

import { useState } from "react";
import Image from "next/image";
import { useAccount, useSignMessage } from "wagmi";
import Shell from "@/components/Shell";
import { postHunt, signHuntRequest, type HuntAuthorization, type HuntReview } from "@/lib/receipt-hunt";

export default function ReceiptHuntReviewPage() {
    const { address } = useAccount();
    const { signMessageAsync } = useSignMessage();
    const [authorization, setAuthorization] = useState<HuntAuthorization | null>(null);
    const [rows, setRows] = useState<HuntReview[]>([]);
    const [selected, setSelected] = useState<HuntReview | null>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");
    const authorized = address && authorization?.wallet === address;

    async function load() {
        if (!address) return;
        setBusy(true); setError(""); setNotice(""); setSelected(null); setAuthorization(null);
        try {
            const auth = await signHuntRequest(address, "review-access", {}, message => signMessageAsync({ message, account: address }));
            const entries = await postHunt<HuntReview[]>("/admin/list", auth);
            setRows(entries); setAuthorization(auth);
        } catch (error) { setError(error instanceof Error ? error.message : "Could not open review queue"); }
        finally { setBusy(false); }
    }

    async function openEvidence(id: string) {
        if (!authorization || !authorized) return;
        setBusy(true); setError(""); setNotice(""); setSelected(null);
        try { setSelected(await postHunt<HuntReview>(`/admin/proof/${id}`, authorization)); }
        catch (error) { setError(error instanceof Error ? error.message : "Could not load evidence"); }
        finally { setBusy(false); }
    }

    async function save() {
        if (!address || !selected || !authorized) return;
        setBusy(true); setError(""); setNotice("");
        try {
            const data = { id: selected.id, revision: selected.revision, followStatus: selected.follow_status, engagementStatus: selected.engagement_status };
            const auth = await signHuntRequest(address, "review", data, message => signMessageAsync({ message, account: address }));
            const result = await postHunt<{ revision: number }>("/admin/review", auth);
            const updated = { ...selected, revision: result.revision };
            setSelected(updated);
            setRows(rows => rows.map(row => row.id === updated.id ? { ...row, ...updated, follow_proof: undefined, engagement_proof: undefined } : row));
            setNotice("Review saved. The Hunt unlocks only when both tasks are approved.");
        } catch (error) { setError(error instanceof Error ? error.message : "Review could not be saved"); }
        finally { setBusy(false); }
    }

    return (
        <Shell>
            <div className="space-y-6">
                <header>
                    <p className="text-xs font-black uppercase tracking-widest text-brand-primary">Receipt Hunt #01</p>
                    <h1 className="mt-2 text-3xl font-black text-white">Review social tasks</h1>
                    <p className="mt-3 text-sm leading-6 text-brand-text-muted">Connect the Replate contract&apos;s validator wallet. Review each screenshot, confirm the X account belongs to this participant, and approve or reject each task. This screen does not send rewards.</p>
                </header>
                <button type="button" disabled={!address || busy} onClick={load} className="rounded-xl bg-brand-primary px-4 py-3 text-sm font-black text-black disabled:opacity-50">{busy ? "Working..." : "Sign in / reload queue"}</button>
                {!address && <p className="text-sm text-brand-text-muted">Connect your administrator wallet using the header.</p>}
                {error && <p role="alert" className="text-sm text-red-300">{error} If your access signature expired, sign in again. A changed submission must be reopened.</p>}
                {notice && <p role="status" className="text-sm text-brand-primary">{notice}</p>}
                {authorized && <>
                    <p className="text-xs text-brand-text-muted">Latest 100 submissions · wallet signatures authorize review only; no transaction fee.</p>
                    {rows.length === 0 && <p className="text-sm text-brand-text-muted">No evidence has been submitted yet.</p>}
                    <ul className="grid gap-3 sm:grid-cols-2">
                        {rows.map(row => <li key={row.id} className="rounded-2xl border border-white/10 p-4">
                            <p className="font-bold text-white">@{row.x_username}</p>
                            <p className="mt-1 break-all text-xs text-brand-text-muted">{row.wallet_address}</p>
                            <p className="mt-2 text-xs text-brand-text-muted">Follow: {row.follow_status} · Like + repost: {row.engagement_status}</p>
                            <button type="button" onClick={() => openEvidence(row.id)} disabled={busy} className="mt-3 rounded-lg border border-brand-primary/30 px-3 py-2 text-xs font-bold text-brand-primary disabled:opacity-50">Review @{row.x_username}</button>
                        </li>)}
                    </ul>
                    {selected && <section className="space-y-5 rounded-3xl border border-brand-primary/20 p-5" aria-labelledby="selected-review-title">
                        <h2 id="selected-review-title" className="text-xl font-black text-white">Evidence: @{selected.x_username}</h2>
                        <p className="break-all text-xs text-brand-text-muted">Participant wallet: {selected.wallet_address}</p>
                        <a href={`https://x.com/${selected.x_username}`} target="_blank" rel="noopener noreferrer" className="inline-block text-sm font-bold text-brand-primary underline">Open X profile (new tab)</a>
                        {selected.repost_url && <a href={selected.repost_url} target="_blank" rel="noopener noreferrer" className="ml-4 inline-block text-sm font-bold text-brand-primary underline">Open submitted post (new tab)</a>}
                        <div className="grid gap-5 lg:grid-cols-2">
                            {(["follow", "engagement"] as const).map(task => <div key={task} className="space-y-3">
                                <h3 className="text-sm font-bold text-white">{task === "follow" ? "Follow @replateapp" : "Like + repost announcement"}</h3>
                                {selected[`${task}_proof`] && <Image unoptimized src={selected[`${task}_proof`]!} alt={`${task} evidence submitted by @${selected.x_username}`} width={1600} height={1600} className="h-auto w-full rounded-xl border border-white/10" />}
                                <label className="block text-xs font-bold text-white"><span>Decision for {task === "follow" ? "follow" : "like + repost"}</span><select disabled={busy} value={selected[`${task}_status`]} onChange={event => setSelected({ ...selected, [`${task}_status`]: event.target.value })} className="mt-2 block w-full rounded-xl border border-white/15 bg-brand-surface px-3 py-3"><option value="pending">Pending</option><option value="approved">Approve</option><option value="rejected">Reject</option></select></label>
                            </div>)}
                        </div>
                        <button type="button" onClick={save} disabled={busy} className="rounded-xl bg-brand-primary px-4 py-3 text-sm font-black text-black disabled:opacity-50">Sign and save review</button>
                    </section>}
                </>}
            </div>
        </Shell>
    );
}

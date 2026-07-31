"use client";

import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import { Gift, Loader2, Lock, Sparkles } from "lucide-react";
import Shell from "@/components/Shell";
import { getApiUrl } from "@/lib/api";

interface Quest { id: string; title: string; progress: number; target: number; completed: boolean; bonusSeasonalXp: number }
interface QuestData {
  weekKey: string;
  quests: Quest[];
  mysteryBox: { eligible: boolean; preview: { type: string; amount: number } };
  note: string;
}

export default function QuestsPage() {
  const { address } = useAccount();
  const [data, setData] = useState<QuestData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!address) return;
    setLoading(true);
    fetch(getApiUrl(`/api/quests/${address}`))
      .then((response) => response.json())
      .then((payload) => {
        if (!payload.success) throw new Error(payload.error || "Quests unavailable");
        setData(payload);
      })
      .catch(() => {
        setData(createOfflineQuestData());
      })
      .finally(() => setLoading(false));
  }, [address]);

  return (
    <Shell>
      <div className="space-y-6">
        <header>
          <p className="text-xs font-black uppercase tracking-[0.25em] text-brand-primary">Weekly challenge</p>
          <h1 className="text-4xl font-black text-white">Healthy Quests</h1>
          <p className="mt-2 text-brand-text/60">Three new challenges rotate every ISO week.</p>
        </header>
        {!address && <Panel>Connect your wallet to reveal this week&apos;s quests.</Panel>}
        {loading && <Panel><Loader2 className="mx-auto animate-spin text-brand-primary" /></Panel>}
        {error && <Panel>{error}</Panel>}
        {data && (
          <>
            <div className="flex items-center justify-between">
              <span className="text-sm text-brand-text/50">{data.weekKey}</span>
              <span className="rounded-full bg-brand-primary/10 px-3 py-1 text-xs font-bold text-brand-primary">
                {data.quests.filter((quest) => quest.completed).length}/3 complete
              </span>
            </div>
            <div className="grid gap-4 lg:grid-cols-3">
              {data.quests.map((quest, index) => {
                const percent = Math.min(100, Math.round((quest.progress / quest.target) * 100));
                return (
                  <article key={quest.id} className="rounded-3xl border border-brand-primary/15 bg-[#0c1310] p-6">
                    <div className="mb-5 flex items-center justify-between">
                      <span className="text-3xl">{["🥗", "🔥", "⭐"][index]}</span>
                      <span className="text-xs font-black text-yellow-400">+{quest.bonusSeasonalXp} seasonal XP</span>
                    </div>
                    <h2 className="min-h-12 text-lg font-black text-white">{quest.title}</h2>
                    <div className="mt-5 h-3 overflow-hidden rounded-full bg-white/5">
                      <div className="h-full rounded-full bg-gradient-to-r from-brand-primary to-lime-300 transition-all duration-700" style={{ width: `${percent}%` }} />
                    </div>
                    <div className="mt-2 flex justify-between text-xs text-brand-text/50"><span>{quest.progress}/{quest.target}</span><span>{percent}%</span></div>
                    {quest.completed && <p className="mt-4 font-bold text-brand-primary">✅ Quest complete</p>}
                  </article>
                );
              })}
            </div>
            <section className="rounded-3xl border border-purple-400/20 bg-gradient-to-br from-purple-950/70 to-[#0c1310] p-7">
              <div className="flex items-center gap-4">
                <div className="rounded-2xl bg-purple-400/10 p-4">{data.mysteryBox.eligible ? <Gift className="text-purple-300" /> : <Lock className="text-purple-300" />}</div>
                <div>
                  <h2 className="text-xl font-black text-white">7-day Mystery Box</h2>
                  <p className="text-sm text-white/55">{data.mysteryBox.eligible ? "Unlocked — your seasonal surprise is ready." : "Keep your check-in streak alive to unlock it."}</p>
                </div>
                <Sparkles className="ml-auto text-yellow-300" />
              </div>
              <p className="mt-5 text-xs leading-5 text-white/40">{data.note}</p>
            </section>
          </>
        )}
      </div>
    </Shell>
  );
}

function createOfflineQuestData(): QuestData {
  const quests = [
    { id: "receipts-2", title: "Submit 2 grocery receipts", progress: 0, target: 2, completed: false, bonusSeasonalXp: 80 },
    { id: "health-65", title: "Reach a 65 weekly health average", progress: 0, target: 65, completed: false, bonusSeasonalXp: 100 },
    { id: "checkin-streak-3", title: "Build a 3-day check-in streak", progress: 0, target: 3, completed: false, bonusSeasonalXp: 70 },
  ];
  return { weekKey: new Date().toISOString().slice(0, 10), quests, mysteryBox: { eligible: false, preview: { type: "seasonal_xp", amount: 25 } }, note: "Offline preview: progress will sync when the quest service is available." };
}
function Panel({ children }: { children: React.ReactNode }) {
  return <div className="rounded-3xl border border-brand-primary/15 bg-[#0c1310] p-12 text-center text-brand-text/60">{children}</div>;
}

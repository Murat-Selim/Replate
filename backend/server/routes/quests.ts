import { Router, Request, Response } from "express";
import {
  claimQuestXp,
  getUserSummary,
  getUserWeekReport,
  isQuestXpClaimed,
} from "../services/contract.js";

const router = Router();

type QuestMetric =
  | "receiptCount"
  | "avgHealthScore"
  | "avgNutritionScore"
  | "checkInStreak"
  | "weekPoints";

interface QuestTemplate {
  id: string;
  title: string;
  metric: QuestMetric;
  target: number;
  bonusSeasonalXp: number;
  description: string;
}

const QUEST_POOL: QuestTemplate[] = [
  { id: "receipts-2", title: "Receipt Combo", metric: "receiptCount", target: 2, bonusSeasonalXp: 80, description: "Verify two grocery receipts this week." },
  { id: "health-65", title: "Smart Swap", metric: "avgHealthScore", target: 65, bonusSeasonalXp: 100, description: "Make one healthier swap in your next basket." },
  { id: "nutrition-70", title: "Green Basket", metric: "avgNutritionScore", target: 70, bonusSeasonalXp: 100, description: "Add fruit or leafy greens to your next basket." },
  { id: "checkin-streak-3", title: "Streak Run", metric: "checkInStreak", target: 3, bonusSeasonalXp: 70, description: "Check in three days in a row." },
  { id: "week-points-300", title: "XP Sprint", metric: "weekPoints", target: 300, bonusSeasonalXp: 120, description: "Stack receipt and check-in points this week." },
];

function getUtcWeekKey(now = new Date()): string {
  const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

function deterministicOffset(seed: string, modulo: number): number {
  let hash = 2166136261;
  for (const char of seed) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % modulo;
}

async function getQuestState(address: string) {
  const [summary, report] = await Promise.all([
    getUserSummary(address),
    getUserWeekReport(address),
  ]);
  const weekKey = getUtcWeekKey();
  const offset = deterministicOffset(weekKey, QUEST_POOL.length);
  const selected = Array.from({ length: 3 }, (_, index) => QUEST_POOL[(offset + index) % QUEST_POOL.length]);
  const metrics: Record<QuestMetric, number> = {
    receiptCount: report.receiptCount,
    avgHealthScore: report.avgHealthScore,
    avgNutritionScore: report.avgNutritionScore,
    checkInStreak: summary.checkInStreak,
    weekPoints: report.weekPoints,
  };
  const claimed = await Promise.all(
    selected.map((quest) => isQuestXpClaimed(address, quest.id, weekKey))
  );
  return { weekKey, selected, metrics, claimed };
}

router.get("/:address", async (req: Request, res: Response) => {
  const { address } = req.params;
  if (typeof address !== "string" || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
    res.status(400).json({ success: false, error: "Valid address is required" });
    return;
  }

  try {
    const { weekKey, selected, metrics, claimed } = await getQuestState(address);

    const mysteryEligible = metrics.checkInStreak >= 7;
    res.json({
      success: true,
      weekKey,
      quests: selected.map((quest, index) => ({
        id: quest.id,
        title: quest.title,
        metric: quest.metric,
        progress: Math.min(metrics[quest.metric], quest.target),
        target: quest.target,
        completed: metrics[quest.metric] >= quest.target,
        claimed: claimed[index],
        claimable: metrics[quest.metric] >= quest.target && !claimed[index],
        bonusSeasonalXp: quest.bonusSeasonalXp,
        description: quest.description,
      })),
      mysteryBox: {
        eligible: mysteryEligible,
        preview: mysteryEligible
          ? { type: "cosmetic_badge_fragment", amount: 1 }
          : { type: "seasonal_xp", amount: 25 },
      },
      note: "Completed quests can be claimed once as on-chain XP through the validator.",
    });
  } catch (error) {
    console.error("Quest status fetch failed:", error);
    res.status(502).json({ success: false, error: "Quest status is temporarily unavailable" });
  }
});

router.post("/:address/claim", async (req: Request, res: Response) => {
  const { address } = req.params;
  const { questId, weekKey } = req.body || {};
  if (typeof address !== "string" || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
    res.status(400).json({ success: false, error: "Valid address is required" });
    return;
  }
  if (typeof questId !== "string" || typeof weekKey !== "string") {
    res.status(400).json({ success: false, error: "questId and weekKey are required" });
    return;
  }

  try {
    const { weekKey: currentWeekKey, selected, metrics, claimed } = await getQuestState(address);
    const questIndex = selected.findIndex((quest) => quest.id === questId);
    const quest = selected[questIndex];
    if (weekKey !== currentWeekKey) {
      res.status(400).json({ success: false, error: "Quest week has expired" });
      return;
    }
    if (!quest) {
      res.status(400).json({ success: false, error: "Quest is not active this week" });
      return;
    }
    if (metrics[quest.metric] < quest.target) {
      res.status(400).json({ success: false, error: "Quest is not complete" });
      return;
    }
    if (claimed[questIndex]) {
      res.status(409).json({ success: false, error: "Quest XP already claimed" });
      return;
    }

    const result = await claimQuestXp(address, quest.id, currentWeekKey, quest.bonusSeasonalXp);
    res.json({ ...result, questId: quest.id, weekKey: currentWeekKey });
  } catch (error: any) {
    const message = error?.message || "Quest XP claim failed";
    const status = message.includes("already claimed") ? 409 : 502;
    console.error("Quest XP claim failed:", error);
    res.status(status).json({ success: false, error: message });
  }
});

export default router;

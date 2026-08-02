import { Router, Request, Response } from "express";
import { getUserSummary, getUserWeekReport } from "../services/contract.js";

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

router.get("/:address", async (req: Request, res: Response) => {
  const { address } = req.params;
  if (typeof address !== "string" || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
    res.status(400).json({ success: false, error: "Valid address is required" });
    return;
  }

  try {
    const [summary, report] = await Promise.all([
      getUserSummary(address),
      getUserWeekReport(address),
    ]);
    const weekKey = getUtcWeekKey();
    const offset = deterministicOffset(`${address.toLowerCase()}:${weekKey}`, QUEST_POOL.length);
    const selected = Array.from({ length: 3 }, (_, index) => QUEST_POOL[(offset + index) % QUEST_POOL.length]);
    const metrics: Record<QuestMetric, number> = {
      receiptCount: report.receiptCount,
      avgHealthScore: report.avgHealthScore,
      avgNutritionScore: report.avgNutritionScore,
      checkInStreak: summary.checkInStreak,
      weekPoints: report.weekPoints,
    };

    const mysteryEligible = summary.checkInStreak >= 7;
    res.json({
      success: true,
      weekKey,
      quests: selected.map((quest) => ({
        id: quest.id,
        title: quest.title,
        metric: quest.metric,
        progress: Math.min(metrics[quest.metric], quest.target),
        target: quest.target,
        completed: metrics[quest.metric] >= quest.target,
        bonusSeasonalXp: quest.bonusSeasonalXp,
        description: quest.description,
      })),
      mysteryBox: {
        eligible: mysteryEligible,
        preview: mysteryEligible
          ? { type: "cosmetic_badge_fragment", amount: 1 }
          : { type: "seasonal_xp", amount: 25 },
      },
      note: "Quest bonuses and mystery-box contents are off-chain seasonal previews only; they do not promise contract XP, tokens, or USDC.",
    });
  } catch (error) {
    console.error("Quest status fetch failed:", error);
    res.status(502).json({ success: false, error: "Quest status is temporarily unavailable" });
  }
});

export default router;
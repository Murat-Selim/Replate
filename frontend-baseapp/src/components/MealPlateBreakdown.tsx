import { Leaf } from "lucide-react";
import type { MealAnalysis, MealGroup } from "@/lib/intelligence";

export const MEAL_GROUP_META: Record<MealGroup, { label: string; color: string }> = {
    vegetables: { label: "Vegetables", color: "#00E36E" },
    fruit: { label: "Fruit", color: "#FB923C" },
    protein: { label: "Protein", color: "#F472B6" },
    grains: { label: "Grains", color: "#FACC15" },
    healthy_fats: { label: "Healthy fats", color: "#38BDF8" },
    processed: { label: "Processed", color: "#94A3B8" },
};

const RING_MASK = "radial-gradient(farthest-side, transparent 62%, #000 63%)";

/** Plate composition ring, plant diversity, detected foods and missing groups for a meal analysis. */
export default function MealPlateBreakdown({ result, muted = "#8c9790", accent = "#00E36E" }: { result: MealAnalysis; muted?: string; accent?: string }) {
    const plate = result.plate ?? [];
    if (!plate.length) return null;
    const stops = plate.reduce<number[]>((ends, { share }) => [...ends, (ends.at(-1) ?? 0) + share], []);
    const filled = stops.at(-1) ?? 0;
    const ring = plate.map(({ group }, index) => `${MEAL_GROUP_META[group].color} ${stops[index - 1] ?? 0}% ${stops[index]}%`).join(", ");

    return (
        <div className="space-y-5">
            <div>
                <p className="mb-3 text-xs font-black uppercase tracking-[0.18em]" style={{ color: muted }}>Plate composition</p>
                <div className="flex items-center gap-5">
                    <div role="img" aria-label={plate.map(({ group, share }) => `${MEAL_GROUP_META[group].label} ${share}%`).join(", ")} className="size-28 shrink-0 rounded-full" style={{ background: `conic-gradient(${ring}, #ffffff14 ${filled}% 100%)`, mask: RING_MASK, WebkitMask: RING_MASK }} />
                    <ul className="grid flex-1 gap-1.5 text-sm">
                        {plate.map(({ group, share }) => (
                            <li key={group} className="flex items-center gap-2 text-white/85">
                                <span className="size-2.5 shrink-0 rounded-full" style={{ background: MEAL_GROUP_META[group].color }} />
                                <span className="font-bold">{MEAL_GROUP_META[group].label}</span>
                                <span className="ml-auto tabular-nums" style={{ color: muted }}>{share}%</span>
                            </li>
                        ))}
                    </ul>
                </div>
                <p className="mt-2 text-xs" style={{ color: muted }}>Balanced plate guide: ½ vegetables & fruit, ¼ protein, ¼ grains.</p>
            </div>

            {(result.missingGroups?.length ?? 0) > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-black uppercase tracking-[0.18em]" style={{ color: muted }}>Missing</span>
                    {result.missingGroups!.map((group) => <span key={group} className="rounded-full border border-dashed border-white/25 px-3 py-1 text-sm font-bold text-white/70">{MEAL_GROUP_META[group].label}</span>)}
                </div>
            )}

            {result.diversity && result.diversity.plantCount > 0 && (
                <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                    <Leaf size={20} style={{ color: accent }} />
                    <div>
                        <p className="text-sm font-black text-white">{result.diversity.plantCount} {result.diversity.plantCount === 1 ? "plant" : "plants"}{result.diversity.colors.length ? ` · ${result.diversity.colors.length} ${result.diversity.colors.length === 1 ? "color" : "colors"}` : ""}</p>
                        <p className="text-xs" style={{ color: muted }}>Aim for 30 different plants a week.</p>
                    </div>
                </div>
            )}

            {(result.items?.length ?? 0) > 0 && (
                <div>
                    <p className="mb-2 text-xs font-black uppercase tracking-[0.18em]" style={{ color: muted }}>Detected foods</p>
                    <div className="flex flex-wrap gap-2">
                        {result.items!.map(({ name, group }) => (
                            <span key={`${name}-${group}`} className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-sm font-bold capitalize text-white/85">
                                <span className="size-2 rounded-full" style={{ background: MEAL_GROUP_META[group].color }} />{name}
                            </span>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

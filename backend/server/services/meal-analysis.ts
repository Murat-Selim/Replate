import { OCRError } from "./ocr.js";
import { validateDoublewordImage } from "./doubleword-ocr.js";

export const MEAL_GROUPS = ["vegetables", "fruit", "protein", "grains", "healthy_fats", "processed"] as const;
export type MealGroup = typeof MEAL_GROUPS[number];
const PLANT_COLORS = ["red", "orange", "yellow", "green", "purple", "white", "brown"] as const;
const VISIBILITY = { clear: 0.92, partial: 0.75, unclear: 0.55 } as const;

const GROUP_LABELS: Record<MealGroup, string> = {
  vegetables: "vegetables", fruit: "fruit", protein: "protein", grains: "whole grains or starch", healthy_fats: "healthy fats", processed: "processed food",
};
/** Generic additions used when the model gives no usable suggestion for a missing group. */
const DEFAULT_ADDITIONS: Partial<Record<MealGroup, string>> = {
  vegetables: "a handful of leafy greens or a side salad",
  protein: "eggs, legumes, yogurt, fish or chicken",
  grains: "a slice of whole-grain bread, bulgur or brown rice",
};

export interface MealModelReading {
  items: Array<{ name: string; group: MealGroup; share: number }>;
  plants: string[];
  colors: string[];
  visibility: keyof typeof VISIBILITY;
  additions: Partial<Record<MealGroup, string>>;
}

export interface MealAnalysisResult {
  detectedLabels: Array<{ label: string; confidence: number }>;
  components: MealGroup[];
  balanceScore: number;
  confidence: number;
  insight: string;
  recommendation: string;
  plate: Array<{ group: MealGroup; share: number }>;
  items: Array<{ name: string; group: MealGroup }>;
  missingGroups: MealGroup[];
  diversity: { plantCount: number; plants: string[]; colors: string[] };
  informationalOnly: true;
}

const MEAL_PROMPT = [
  "You analyze a photo of a meal. Identify only foods you can actually see; do not guess hidden ingredients.",
  `For each visible food give: name (short English, lowercase), group (one of ${MEAL_GROUPS.join(", ")}), share (estimated percent of the visible plate area, integers summing to about 100).`,
  "Groups: vegetables (incl. legumes served as vegetables), fruit, protein (meat, fish, eggs, tofu, legumes, cheese, yogurt), grains (bread, rice, pasta, bulgur, potatoes, oats), healthy_fats (olives, nuts, seeds, avocado, olive oil), processed (sweets, desserts, fries, fried snacks, processed meat, sugary drinks, fast food).",
  "plants: distinct plant foods visible (vegetables, fruits, herbs, legumes, nuts, seeds, whole grains), lowercase English, no duplicates.",
  `colors: distinct colors of the visible plant foods, each one of ${PLANT_COLORS.join(", ")}.`,
  "visibility: clear, partial or unclear, describing how well the foods can be identified.",
  `additions: for each of vegetables, protein, grains that is missing or under 15% of the plate, one short practical addition (max 60 characters) that fits this specific meal, e.g. {"grains":"a slice of whole-grain bread"}.`,
  'If the photo does not show food, reply {"items":[]}.',
  'Reply with only JSON: {"items":[{"name":"feta cheese","group":"protein","share":20}],"plants":["tomato"],"colors":["red"],"visibility":"clear","additions":{"grains":"..."}}',
].join("\n");

const cleanText = (value: unknown, max: number) => typeof value === "string" ? value.replace(/[\r\n\t]+/g, " ").replace(/\s+/g, " ").trim().slice(0, max) : "";

/** Validate free-form model JSON against the fixed vocabulary; anything outside it is dropped. */
export function parseMealReading(content: string): MealModelReading {
  const json = content.match(/\{[\s\S]*\}/)?.[0];
  if (!json) throw new OCRError("Meal analysis returned an invalid reading", "OCR_API_ERROR");
  const raw = JSON.parse(json) as Record<string, unknown>;
  const items = (Array.isArray(raw.items) ? raw.items : []).flatMap((item: Record<string, unknown>) => {
    const name = cleanText(item?.name, 40).toLowerCase();
    const group = item?.group as MealGroup;
    const share = Number(item?.share);
    if (!name || !MEAL_GROUPS.includes(group) || !Number.isFinite(share) || share <= 0) return [];
    return [{ name, group, share: Math.min(share, 100) }];
  }).slice(0, 15);
  const plants = [...new Set((Array.isArray(raw.plants) ? raw.plants : []).map((plant) => cleanText(plant, 30).toLowerCase()).filter(Boolean))].slice(0, 30);
  const colors = [...new Set((Array.isArray(raw.colors) ? raw.colors : []).filter((color): color is string => PLANT_COLORS.includes(color as typeof PLANT_COLORS[number])))];
  const visibility = (Object.keys(VISIBILITY) as Array<keyof typeof VISIBILITY>).find((key) => key === raw.visibility) ?? "partial";
  const additions: MealModelReading["additions"] = {};
  if (raw.additions && typeof raw.additions === "object") {
    for (const group of ["vegetables", "protein", "grains"] as const) {
      const text = cleanText((raw.additions as Record<string, unknown>)[group], 60);
      if (text) additions[group] = text;
    }
  }
  return { items, plants, colors, visibility, additions };
}

/**
 * Score a reading against a simple balanced-plate model: half produce, a quarter protein, a quarter grains.
 * The model only describes the plate; every number shown to the user is computed here.
 */
export function scoreMeal(reading: MealModelReading): MealAnalysisResult {
  const totals = new Map<MealGroup, number>();
  for (const item of reading.items) totals.set(item.group, (totals.get(item.group) ?? 0) + item.share);
  const sum = [...totals.values()].reduce((total, share) => total + share, 0);
  const plate = MEAL_GROUPS.filter((group) => totals.has(group))
    .map((group) => ({ group, share: Math.round((totals.get(group)! / sum) * 100) }))
    .sort((a, b) => b.share - a.share);
  const share = (group: MealGroup) => plate.find((entry) => entry.group === group)?.share ?? 0;

  const produce = share("vegetables") + share("fruit");
  // A sprinkle (under 10%) does not count as covering a food group.
  const missingGroups = (["vegetables", "protein", "grains"] as const).filter((group) =>
    group === "vegetables" ? produce < 10 : share(group) < 10);
  const plantCount = reading.plants.length;
  const coverage = (3 - missingGroups.length) * 20;
  const produceScore = Math.min(produce / 50, 1) * 20;
  const varietyScore = Math.min(plantCount / 5, 1) * 10;
  const fatsScore = share("healthy_fats") > 0 ? 5 : 0;
  const balanceScore = Math.round(Math.max(10, Math.min(100, 5 + coverage + produceScore + varietyScore + fatsScore - share("processed") * 0.4)));

  const processedHeavy = share("processed") >= 30;
  const firstMissing = missingGroups[0];
  const recommendation = processedHeavy
    ? `Swap part of the processed food for ${reading.additions.vegetables ?? DEFAULT_ADDITIONS.vegetables}.`
    : firstMissing
      ? `Add ${reading.additions[firstMissing] ?? DEFAULT_ADDITIONS[firstMissing]} to bring in ${GROUP_LABELS[firstMissing]}.`
      : produce < 40
        ? `Make vegetables closer to half the plate, e.g. ${reading.additions.vegetables ?? DEFAULT_ADDITIONS.vegetables}.`
        : "Keep rotating colors, textures and whole-food ingredients.";
  const insight = missingGroups.length === 0 && !processedHeavy
    ? "This meal covers the main food groups."
    : missingGroups.length === 1 && !processedHeavy
      ? `Nearly balanced: only ${GROUP_LABELS[missingGroups[0]]} is missing.`
      : "This meal has a clear starting point for better balance.";
  const confidence = VISIBILITY[reading.visibility];

  return {
    detectedLabels: reading.items.slice(0, 8).map(({ name }) => ({ label: name, confidence })),
    components: plate.map((entry) => entry.group),
    balanceScore,
    confidence,
    insight,
    recommendation,
    plate,
    items: reading.items.map(({ name, group }) => ({ name, group })),
    missingGroups,
    diversity: { plantCount, plants: reading.plants, colors: reading.colors },
    informationalOnly: true,
  };
}

/** One realtime vision-model call; throws OCRError("OCR_INVALID_INPUT") when no food is visible. */
export async function analyzeMealPhoto(imageBase64: string): Promise<MealAnalysisResult> {
  const apiKey = process.env.OCR_API_KEY?.trim();
  if (!apiKey) throw new OCRError("Meal analysis is not configured", "OCR_API_ERROR");
  const { base64, mime } = validateDoublewordImage(imageBase64);
  let content: string;
  try {
    const response = await fetch("https://api.doubleword.ai/v1/chat/completions", {
      method: "POST",
      redirect: "error",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      signal: AbortSignal.timeout(30000),
      body: JSON.stringify({
        model: "Qwen/Qwen3.6-35B-A3B-FP8", reasoning_effort: "none", temperature: 0, max_tokens: 1200,
        stream: false, service_tier: "priority",
        messages: [{ role: "user", content: [
          { type: "text", text: MEAL_PROMPT },
          { type: "image_url", image_url: { url: `data:${mime};base64,${base64}` } },
        ] }],
      }),
    });
    if (!response.ok) throw new OCRError(`Meal analysis failed (HTTP ${response.status})`, "OCR_API_ERROR");
    const data = await response.json() as { choices?: Array<{ finish_reason?: string; message?: { content?: string } }> };
    if (data.choices?.[0]?.finish_reason !== "stop") throw new OCRError("Meal analysis returned an incomplete reading", "OCR_API_ERROR");
    content = data.choices[0].message?.content ?? "";
  } catch (error) {
    if (error instanceof OCRError) throw error;
    // Never expose provider error bodies, API keys or the photo in logs.
    throw new OCRError("Meal analysis could not finish", "OCR_API_ERROR");
  }
  const reading = parseMealReading(content);
  if (!reading.items.length) throw new OCRError("No meal was detected in this photo. Try a clear, well-lit photo of the plate.", "OCR_INVALID_INPUT");
  return scoreMeal(reading);
}

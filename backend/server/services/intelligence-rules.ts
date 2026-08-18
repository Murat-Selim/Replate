export const INTELLIGENCE_RULE_VERSION = "v1";

export interface IntelligenceFeatureSet {
  health_score: number;
  nutrition_score: number;
  basket_diversity: number;
  processed_food_ratio: number;
  fruit_veg_ratio: number;
  protein_ratio: number;
}

export interface IntelligenceInsight {
  type: "positive" | "recommendation" | "warning";
  message: string;
  evidence: string[];
}

export interface IntelligenceReport {
  healthScore: number;
  nutritionScore: number;
  basketDiversity: number;
  processedFoodRatio: number;
  fruitVegRatio: number;
  proteinRatio: number;
  insights: IntelligenceInsight[];
  recommendations: IntelligenceInsight[];
  insightConfidence: number;
  ruleVersion: string;
}

export function buildIntelligenceReport(features: IntelligenceFeatureSet): IntelligenceReport {
  const insights: IntelligenceInsight[] = [];
  const recommendations: IntelligenceInsight[] = [];

  if (features.processed_food_ratio > 0.4) {
    recommendations.push({
      type: "warning",
      message: "Processed foods make up a large share of this basket.",
      evidence: ["processed_food_ratio"],
    });
  }
  if (features.fruit_veg_ratio < 0.5) {
    recommendations.push({
      type: "recommendation",
      message: "Add more fruit and vegetables to improve basket coverage.",
      evidence: ["fruit_veg_ratio"],
    });
  }
  if (features.basket_diversity < 0.5) {
    recommendations.push({
      type: "recommendation",
      message: "Increase variety by rotating more distinct whole-food options.",
      evidence: ["basket_diversity"],
    });
  }
  if (features.protein_ratio < 0.15) {
    recommendations.push({
      type: "recommendation",
      message: "Include a wider range of protein sources in future baskets.",
      evidence: ["protein_ratio"],
    });
  }
  if (features.health_score >= 75 && features.processed_food_ratio < 0.3) {
    insights.push({
      type: "positive",
      message: "This basket has a strong health profile with limited processed-food pressure.",
      evidence: ["health_score", "processed_food_ratio"],
    });
  }

  const signalCount = Object.keys(features).length;
  const insightConfidence = Number(Math.min(1, Math.max(0, 0.6 + (signalCount >= 6 ? 0.26 : 0))).toFixed(2));
  return {
    healthScore: features.health_score,
    nutritionScore: features.nutrition_score,
    basketDiversity: features.basket_diversity,
    processedFoodRatio: features.processed_food_ratio,
    fruitVegRatio: features.fruit_veg_ratio,
    proteinRatio: features.protein_ratio,
    insights,
    recommendations,
    insightConfidence,
    ruleVersion: INTELLIGENCE_RULE_VERSION,
  };
}

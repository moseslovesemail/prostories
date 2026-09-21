import type { EditorialConfig, ScoringConfig } from "./config.js";
import type { RawItem, ScoreBreakdown } from "./types.js";
import { containsTerm } from "./utils.js";

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value));
}

function countTerms(text: string, terms: string[]): number {
  return terms.reduce((count, term) => count + (containsTerm(text, term) ? 1 : 0), 0);
}

function recencyScore(publishedAt?: string): number {
  if (!publishedAt) return 60;
  const date = new Date(publishedAt);
  if (Number.isNaN(date.getTime())) return 60;

  const ageDays = Math.max(0, (Date.now() - date.getTime()) / 86_400_000);
  if (ageDays <= 2) return 100;
  if (ageDays <= 7) return 88;
  if (ageDays <= 14) return 72;
  if (ageDays <= 30) return 55;
  if (ageDays <= 90) return 30;
  return 15;
}

export function scoreItem(
  item: RawItem,
  topics: string[],
  editorial: EditorialConfig,
  scoring: ScoringConfig
): ScoreBreakdown {
  const text = `${item.title} ${item.summary}`;
  const exclusion = editorial.exclude_terms.find((term) => containsTerm(text, term));
  const riskMatches = countTerms(text, editorial.high_risk_terms);
  const constructiveMatches = countTerms(text, editorial.constructive_terms);

  const communityRisk = exclusion
    ? scoring.community_risk.hard_exclusion_score
    : clamp(
        scoring.community_risk.base +
          riskMatches * scoring.community_risk.high_risk_term_penalty,
        0,
        scoring.community_risk.max
      );

  const sourceConfidence = clamp(item.trust);
  const editorialFit = clamp(
    48 +
      Math.min(topics.length, 6) * 6 +
      Math.min(constructiveMatches, 5) * 5 -
      Math.max(0, riskMatches - 1) * 4
  );

  const hopefulTopics = new Set([
    "animals",
    "community",
    "connection",
    "consumer_wins",
    "accountability",
    "environmental_progress",
    "music",
    "art",
    "books",
    "space",
  ]);
  const hopefulTopicCount = topics.filter((topic) => hopefulTopics.has(topic)).length;
  const hopeConnection = clamp(
    38 + Math.min(constructiveMatches, 5) * 9 + Math.min(hopefulTopicCount, 3) * 8
  );

  const interestingness = clamp(
    48 +
      Math.min(constructiveMatches, 4) * 7 +
      (containsTerm(text, "first") ? 8 : 0) +
      (containsTerm(text, "discovered") || containsTerm(text, "discovery") ? 8 : 0) +
      (containsTerm(text, "new species") ? 10 : 0)
  );

  const isNzText =
    containsTerm(text, "new zealand") ||
    containsTerm(text, "aotearoa") ||
    containsTerm(text, "māori") ||
    containsTerm(text, "kiwi");
  const aotearoaRelevance = item.country === "NZ" ? 100 : isNzText ? 75 : 35;

  const visualTopics = new Set(["animals", "art", "music", "food", "space", "natural_world"]);
  const socialPotential = clamp(
    52 +
      topics.filter((topic) => visualTopics.has(topic)).length * 7 +
      Math.min(constructiveMatches, 3) * 5
  );

  const originality = 70;
  const recency = recencyScore(item.publishedAt);

  const values: Record<string, number> = {
    source_confidence: sourceConfidence,
    editorial_fit: editorialFit,
    hope_connection: hopeConnection,
    interestingness,
    aotearoa_relevance: aotearoaRelevance,
    social_potential: socialPotential,
    originality,
    recency,
  };

  const weightTotal = Object.values(scoring.weights).reduce((sum, value) => sum + value, 0);
  const weighted = Object.entries(scoring.weights).reduce(
    (sum, [key, weight]) => sum + (values[key] || 0) * weight,
    0
  );

  const sourceWeightedTotal = clamp((weighted / weightTotal) * item.sourceWeight);

  return {
    source_confidence: Math.round(sourceConfidence),
    editorial_fit: Math.round(editorialFit),
    hope_connection: Math.round(hopeConnection),
    interestingness: Math.round(interestingness),
    aotearoa_relevance: Math.round(aotearoaRelevance),
    social_potential: Math.round(socialPotential),
    originality: Math.round(originality),
    recency: Math.round(recency),
    community_risk: Math.round(communityRisk),
    total: exclusion ? 0 : Math.round(sourceWeightedTotal),
    excluded: Boolean(exclusion),
    exclusion_reason: exclusion ? `Matched exclusion term: ${exclusion}` : undefined,
  };
}

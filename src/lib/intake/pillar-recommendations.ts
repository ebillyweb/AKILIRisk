import { RISK_AREAS } from "@/lib/advisor/types";
import { normalizePillarSlug } from "@/lib/assessment/pillar-registry";

export type PillarRecommendationStrength = "strong" | "moderate" | "low";

export type PillarRecommendationReason = {
  questionId: string;
  questionLabel: string;
  excerpt: string;
};

export type PillarRecommendation = {
  pillarId: string;
  pillarName: string;
  strength: PillarRecommendationStrength;
  score: number;
  reasons: PillarRecommendationReason[];
  suggestedAction?: string;
};

const STRONG_SCORE = 3;
const MODERATE_SCORE = 1;
const EXCERPT_MAX = 140;

function truncateExcerpt(text: string): string {
  const t = text.trim();
  if (t.length <= EXCERPT_MAX) return t;
  return `${t.slice(0, EXCERPT_MAX - 1)}…`;
}

function strengthForScore(score: number): PillarRecommendationStrength {
  if (score >= STRONG_SCORE) return "strong";
  if (score >= MODERATE_SCORE) return "moderate";
  return "low";
}

export type ComputePillarRecommendationsInput = {
  questions: Array<{
    id: string;
    questionText: string;
    relatedPillarIds?: string[];
    recommendedActions?: string;
  }>;
  responses: Array<{
    questionId: string;
    transcription?: string | null;
  }>;
};

/**
 * Rank pillars from intake answers tagged with relatedPillarIds (US-70).
 */
export function computePillarRecommendations(
  input: ComputePillarRecommendationsInput,
): PillarRecommendation[] {
  const responseByQuestion = new Map(
    input.responses.map((r) => [r.questionId, r.transcription?.trim() ?? ""]),
  );

  const aggregates = new Map<
    string,
    { score: number; reasons: PillarRecommendationReason[]; actions: string[] }
  >();

  for (const question of input.questions) {
    const pillarIds = question.relatedPillarIds ?? [];
    if (pillarIds.length === 0) continue;

    const answer = responseByQuestion.get(question.id);
    if (!answer) continue;

    const weight = question.recommendedActions?.trim() ? 2 : 1;
    const reason: PillarRecommendationReason = {
      questionId: question.id,
      questionLabel: question.questionText.trim(),
      excerpt: truncateExcerpt(answer),
    };

    for (const rawId of pillarIds) {
      const pillarId = normalizePillarSlug(rawId);
      const entry = aggregates.get(pillarId) ?? {
        score: 0,
        reasons: [],
        actions: [],
      };
      entry.score += weight;
      entry.reasons.push(reason);
      const action = question.recommendedActions?.trim();
      if (action) entry.actions.push(action);
      aggregates.set(pillarId, entry);
    }
  }

  const byId = new Map(RISK_AREAS.map((a) => [a.id, a]));

  return RISK_AREAS.map((area) => {
    const entry = aggregates.get(area.id);
    const score = entry?.score ?? 0;
    return {
      pillarId: area.id,
      pillarName: area.name,
      strength: strengthForScore(score),
      score,
      reasons: entry?.reasons ?? [],
      suggestedAction: entry?.actions[0],
    };
  }).sort((a, b) => b.score - a.score || a.pillarName.localeCompare(b.pillarName));
}

export function strongRecommendationPillarIds(
  recommendations: PillarRecommendation[],
): string[] {
  return recommendations
    .filter((r) => r.strength === "strong")
    .map((r) => r.pillarId);
}

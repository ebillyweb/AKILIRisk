import { getVisibleQuestions } from "./branching";
import { buildHighestMaturityAnswers } from "./highest-maturity-answers";
import { buildLowestMaturityAnswers } from "./lowest-maturity-answers";
import { normalizePillarSlug } from "./pillar-registry";
import {
  CYBER_DIGITAL_ALL_NEGATIVE_NARRATIVE_RECOMMENDATIONS,
  GEOGRAPHIC_ENVIRONMENTAL_ALL_NEGATIVE_NARRATIVE_RECOMMENDATIONS,
  GEOGRAPHIC_ENVIRONMENTAL_ALL_YES_NARRATIVE_RECOMMENDATIONS,
  GOVERNANCE_ALL_NEGATIVE_NARRATIVE_RECOMMENDATIONS,
  GOVERNANCE_ALL_YES_NARRATIVE_RECOMMENDATIONS,
  CYBER_DIGITAL_ALL_YES_NARRATIVE_RECOMMENDATIONS,
  INSURANCE_ALL_NEGATIVE_NARRATIVE_RECOMMENDATIONS,
  INSURANCE_ALL_YES_NARRATIVE_RECOMMENDATIONS,
  PHYSICAL_SECURITY_ALL_NEGATIVE_NARRATIVE_RECOMMENDATIONS,
  PHYSICAL_SECURITY_ALL_YES_NARRATIVE_RECOMMENDATIONS,
  REPUTATIONAL_SOCIAL_ALL_NEGATIVE_NARRATIVE_RECOMMENDATIONS,
  REPUTATIONAL_SOCIAL_ALL_YES_NARRATIVE_RECOMMENDATIONS,
  PILLAR_MID_BAND_NARRATIVE_RECOMMENDATIONS,
} from "./pillar-outcome-expectations";
import type { Question, RiskLevel, ScoreResult } from "./types";
import type { SnapshotPillarNarrative } from "@/lib/methodology/types";

/** Accepts scoring-engine or Prisma `RiskLevel` enum strings. */
export function normalizeScoreRiskLevel(riskLevel: RiskLevel | string): RiskLevel {
  const normalized = String(riskLevel).toLowerCase();
  if (
    normalized === "low" ||
    normalized === "medium" ||
    normalized === "high" ||
    normalized === "critical"
  ) {
    return normalized;
  }
  return "medium";
}

const ALL_NEGATIVE_NARRATIVES_BY_PILLAR: Partial<
  Record<string, readonly string[]>
> = {
  governance: GOVERNANCE_ALL_NEGATIVE_NARRATIVE_RECOMMENDATIONS,
  "cyber-digital": CYBER_DIGITAL_ALL_NEGATIVE_NARRATIVE_RECOMMENDATIONS,
  "physical-security": PHYSICAL_SECURITY_ALL_NEGATIVE_NARRATIVE_RECOMMENDATIONS,
  insurance: INSURANCE_ALL_NEGATIVE_NARRATIVE_RECOMMENDATIONS,
  "geographic-environmental": GEOGRAPHIC_ENVIRONMENTAL_ALL_NEGATIVE_NARRATIVE_RECOMMENDATIONS,
  "reputational-social": REPUTATIONAL_SOCIAL_ALL_NEGATIVE_NARRATIVE_RECOMMENDATIONS,
};

const ALL_YES_NARRATIVES_BY_PILLAR: Partial<Record<string, readonly string[]>> = {
  governance: GOVERNANCE_ALL_YES_NARRATIVE_RECOMMENDATIONS,
  "cyber-digital": CYBER_DIGITAL_ALL_YES_NARRATIVE_RECOMMENDATIONS,
  "physical-security": PHYSICAL_SECURITY_ALL_YES_NARRATIVE_RECOMMENDATIONS,
  insurance: INSURANCE_ALL_YES_NARRATIVE_RECOMMENDATIONS,
  "geographic-environmental": GEOGRAPHIC_ENVIRONMENTAL_ALL_YES_NARRATIVE_RECOMMENDATIONS,
  "reputational-social": REPUTATIONAL_SOCIAL_ALL_YES_NARRATIVE_RECOMMENDATIONS,
};

/**
 * Pillar-level narrative recommendations:
 * - All lowest + critical → all-negative copy
 * - All highest + low → all-yes copy
 * - Otherwise → mid-band copy for the aggregate risk tier (critical / high / medium / low)
 */
export function pillarNarrativeRecommendations(
  pillarId: string,
  score: ScoreResult,
  answers: Record<string, unknown>,
  questions: Question[],
  snapshotNarrative?: SnapshotPillarNarrative,
): string[] {
  const normalized = normalizePillarSlug(pillarId);
  const riskLevel = normalizeScoreRiskLevel(score.riskLevel);

  if (snapshotNarrative) {
    if (
      riskLevel === "critical" &&
      allVisibleAnswersMatchBand(answers, questions, "lowest")
    ) {
      if (snapshotNarrative.allNegative.length) return [...snapshotNarrative.allNegative];
    }
    if (
      riskLevel === "low" &&
      allVisibleAnswersMatchBand(answers, questions, "highest")
    ) {
      if (snapshotNarrative.allYes.length) return [...snapshotNarrative.allYes];
    }
    const tierNarratives = snapshotNarrative.midBand[riskLevel];
    if (tierNarratives?.length) return [...tierNarratives];
    return [];
  }

  if (
    riskLevel === "critical" &&
    allVisibleAnswersMatchBand(answers, questions, "lowest")
  ) {
    const negative = ALL_NEGATIVE_NARRATIVES_BY_PILLAR[normalized];
    if (negative) return [...negative];
  }

  if (
    riskLevel === "low" &&
    allVisibleAnswersMatchBand(answers, questions, "highest")
  ) {
    const positive = ALL_YES_NARRATIVES_BY_PILLAR[normalized];
    if (positive) return [...positive];
  }

  const midBand = PILLAR_MID_BAND_NARRATIVE_RECOMMENDATIONS[normalized];
  if (midBand) {
    const tierNarratives = midBand[riskLevel];
    if (tierNarratives?.length) {
      return [...tierNarratives];
    }
  }

  return [];
}

/** Resolve canonical pillar narrative copy from stored score + live answers. */
export function resolvePillarNarratives(
  pillarId: string,
  score: number,
  riskLevel: RiskLevel | string,
  answers: Record<string, unknown>,
  questions: Question[],
  snapshotNarrative?: SnapshotPillarNarrative,
): string[] {
  return pillarNarrativeRecommendations(
    pillarId,
    {
      score,
      riskLevel: normalizeScoreRiskLevel(riskLevel),
      breakdown: [],
      missingControls: [],
    },
    answers,
    questions,
    snapshotNarrative,
  );
}

function allVisibleAnswersMatchBand(
  answers: Record<string, unknown>,
  questions: Question[],
  band: "lowest" | "highest"
): boolean {
  const visibleIds = getVisibleQuestions(answers, questions).map((q) => q.id);
  const expected =
    band === "lowest"
      ? buildLowestMaturityAnswers(questions, visibleIds)
      : buildHighestMaturityAnswers(questions, visibleIds);

  for (const id of visibleIds) {
    if (answers[id] !== expected[id]) {
      return false;
    }
  }

  return visibleIds.length > 0;
}

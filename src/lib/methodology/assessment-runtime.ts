import "server-only";

import { getPillarAssessmentConfig } from "@/lib/assessment/pillar-config";
import { normalizePillarScoreId } from "@/lib/assessment/pillar-registry";
import { resolvePillarNarratives } from "@/lib/assessment/pillar-outcomes";
import { getActiveRiskThresholds } from "@/lib/assessment/risk-thresholds";
import type { RiskThresholds } from "@/lib/assessment/governance-rubric";
import type { Pillar, Question } from "@/lib/assessment/types";
import { identityRiskPillar, identityRiskQuestions } from "@/lib/identity-risk/questions";
import {
  pillarAssessmentConfigFromSnapshot,
} from "@/lib/methodology/assessment-from-snapshot";
import {
  recommendationRulesFromSnapshot,
  snapshotThresholdForPillar,
} from "@/lib/methodology/snapshot-helpers";
import { loadSnapshotForAssessment } from "@/lib/methodology/snapshot";
import type { RecommendationRule } from "@/lib/assessment/engines/recommendation-engine";

function pillarSlugFromScoreKey(pillarKey: string): string {
  if (pillarKey === "family-governance") return "governance";
  return normalizePillarScoreId(pillarKey);
}

/** Snapshot-pinned pillar config for an assessment; falls back to platform bank. */
export async function resolvePillarConfigForAssessment(
  assessmentId: string,
  pillarKey: string,
): Promise<{ pillarData: Pillar; questions: Question[] } | null> {
  if (pillarKey === "identity-risk") {
    return { pillarData: identityRiskPillar, questions: identityRiskQuestions };
  }

  const pillarSlug = pillarSlugFromScoreKey(pillarKey);
  const snapshot = await loadSnapshotForAssessment(assessmentId);
  if (snapshot) {
    const fromSnapshot = pillarAssessmentConfigFromSnapshot(snapshot, pillarSlug);
    if (fromSnapshot) return fromSnapshot;
  }
  return getPillarAssessmentConfig(pillarSlug);
}

export async function resolveThresholdsForAssessmentPillar(
  assessmentId: string,
  pillarKey: string,
): Promise<RiskThresholds> {
  const pillarSlug = pillarSlugFromScoreKey(pillarKey);
  const snapshot = await loadSnapshotForAssessment(assessmentId);
  const pinned = snapshot ? snapshotThresholdForPillar(snapshot, pillarSlug) : null;
  if (pinned) return pinned;
  return getActiveRiskThresholds();
}

export async function resolveRecommendationRulesForAssessment(
  assessmentId: string,
): Promise<RecommendationRule[] | undefined> {
  const snapshot = await loadSnapshotForAssessment(assessmentId);
  if (!snapshot) return undefined;
  return recommendationRulesFromSnapshot(snapshot);
}

export async function resolvePillarNarrativesForAssessment(
  assessmentId: string,
  pillarKey: string,
  score: number,
  riskLevel: string,
  answers: Record<string, unknown>,
): Promise<string[]> {
  const pillarSlug = pillarSlugFromScoreKey(pillarKey);
  const config = await resolvePillarConfigForAssessment(assessmentId, pillarKey);
  if (!config) return [];

  const snapshot = await loadSnapshotForAssessment(assessmentId);
  const snapshotNarrative = snapshot?.pillarNarratives[pillarSlug];

  return resolvePillarNarratives(
    pillarSlug,
    score,
    riskLevel,
    answers,
    config.questions,
    snapshotNarrative,
  );
}

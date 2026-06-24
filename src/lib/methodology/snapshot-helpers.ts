import type { RecommendationRule } from "@/lib/assessment/engines/recommendation-engine";
import type { MethodologySnapshotBlob } from "@/lib/methodology/types";

export function recommendationRulesFromSnapshot(
  snapshot: MethodologySnapshotBlob,
): RecommendationRule[] {
  return snapshot.recRules.map((rule) => ({
    id: rule.id,
    serviceId: rule.serviceId,
    conditions: rule.conditions,
    priority: rule.priority,
  }));
}

export function snapshotThresholdForPillar(
  snapshot: MethodologySnapshotBlob,
  pillarSlug: string,
) {
  return (
    snapshot.pillars.find((p) => p.slug === pillarSlug)?.threshold ?? null
  );
}

export function snapshotQuestionsForPillar(
  snapshot: MethodologySnapshotBlob,
  pillarSlug: string,
) {
  return snapshot.assessmentQuestions[pillarSlug] ?? [];
}

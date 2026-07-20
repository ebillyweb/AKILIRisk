export type PillarCardStatus = "not-started" | "in-progress" | "completed";

/**
 * Resolve per-domain card status from the loaded assessment only.
 * Without an assessmentId, status cannot be known — callers should surface
 * an error instead of inferring completion from other APIs.
 */
export function resolvePillarCardStatus(input: {
  pillarSlug: string;
  assessmentId: string | null;
  scoredPillarIds: ReadonlySet<string>;
  hasAnswers: boolean;
}): PillarCardStatus {
  if (!input.assessmentId) {
    return "not-started";
  }
  if (input.scoredPillarIds.has(input.pillarSlug)) {
    return "completed";
  }
  return input.hasAnswers ? "in-progress" : "not-started";
}

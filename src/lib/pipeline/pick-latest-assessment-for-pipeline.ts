import type { AssessmentStatus } from "@prisma/client";

export type AssessmentPipelineSnapshot = {
  id: string;
  status: AssessmentStatus;
  startedAt: Date | null;
  updatedAt: Date;
  completedAt: Date | null;
  /** When known, used to prefer scored work over empty restart shells. */
  scoreCount?: number;
  /** When known, used to prefer answered-but-unscored work over empty shells. */
  responseCount?: number;
};

/**
 * Prefer real progress over a newer empty restart — same idea as
 * `pickIntakeForPipeline`. Active in-progress scoring beats an older
 * completed row; completed beats an empty in-progress shell.
 */
function assessmentPriority(a: AssessmentPipelineSnapshot): number {
  const scores = a.scoreCount ?? 0;
  const responses = a.responseCount ?? 0;

  if (a.status === "IN_PROGRESS" && scores > 0) return 5;
  if (a.status === "COMPLETED" || a.completedAt != null) return 4;
  if (a.status === "IN_PROGRESS" && responses > 0) return 3;
  if (a.status === "IN_PROGRESS") return 2;
  return 1;
}

/**
 * Pick the client's current assessment for pipeline / summary views.
 */
export function pickLatestAssessmentForPipeline<T extends AssessmentPipelineSnapshot>(
  assessments: T[],
): T | null {
  if (assessments.length === 0) return null;

  return [...assessments].sort((a, b) => {
    const rank = assessmentPriority(b) - assessmentPriority(a);
    if (rank !== 0) return rank;

    const byScores = (b.scoreCount ?? 0) - (a.scoreCount ?? 0);
    if (byScores !== 0) return byScores;

    const byStarted =
      (b.startedAt?.getTime() ?? 0) - (a.startedAt?.getTime() ?? 0);
    if (byStarted !== 0) return byStarted;
    return b.updatedAt.getTime() - a.updatedAt.getTime();
  })[0];
}

import type { IntakeStatus } from "@prisma/client";

export type IntakePipelineSnapshot = {
  id: string;
  status: IntakeStatus;
  submittedAt: Date | null;
  updatedAt: Date;
  startedAt?: Date | null;
};

function intakePriority(status: IntakeStatus, submittedAt: Date | null): number {
  if (submittedAt != null || status === "SUBMITTED") return 4;
  if (status === "COMPLETED") return 3;
  if (status === "IN_PROGRESS") return 2;
  return 1;
}

/**
 * Prefer a submitted/completed interview over a newer empty restart so pipeline
 * stage and advisor detail reflect real client progress.
 */
export function pickIntakeForPipeline<T extends IntakePipelineSnapshot>(
  interviews: T[],
): T | null {
  if (interviews.length === 0) return null;

  return [...interviews].sort((a, b) => {
    const rank =
      intakePriority(b.status, b.submittedAt) -
      intakePriority(a.status, a.submittedAt);
    if (rank !== 0) return rank;

    const bTime = (b.submittedAt ?? b.updatedAt).getTime();
    const aTime = (a.submittedAt ?? a.updatedAt).getTime();
    return bTime - aTime;
  })[0];
}

export function isIntakeFinishedForPipeline(
  intake: Pick<IntakePipelineSnapshot, "status" | "submittedAt"> | null | undefined,
): boolean {
  if (!intake) return false;
  return (
    intake.submittedAt != null ||
    intake.status === "SUBMITTED" ||
    intake.status === "COMPLETED"
  );
}

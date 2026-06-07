import type { ApprovalStatus, IntakeStatus } from "@prisma/client";

export type IntakeApprovalSnapshot = {
  status: ApprovalStatus;
} | null;

export type IntakeForReviewCheck = {
  id: string;
  status: IntakeStatus;
  submittedAt: Date | null;
};

export type IntakeReviewContext = {
  /** Household finished assessment — intake is effectively complete for pipeline UX. */
  assessmentCompleted?: boolean;
};

/**
 * True when the client submitted intake and the advisor has not approved or rejected it.
 * Aligns with Epic 5.2 intake review (US-11): SUBMITTED interview + approval not terminal.
 *
 * When the assessment is already COMPLETED, returns false: the household progressed
 * past intake and "awaiting review" is misleading on the client detail view.
 */
export function isIntakeAwaitingAdvisorReview(
  intake: IntakeForReviewCheck | null | undefined,
  approval: IntakeApprovalSnapshot,
  intakeWaived: boolean,
  context: IntakeReviewContext = {},
): boolean {
  if (context.assessmentCompleted || intakeWaived || !intake) return false;

  const submitted =
    intake.submittedAt != null ||
    intake.status === "SUBMITTED" ||
    intake.status === "COMPLETED";

  if (!submitted) return false;

  if (!approval) return true;

  return approval.status === "PENDING" || approval.status === "IN_REVIEW";
}

/** Build per-client index from batched intake + approval rows (latest submitted interview per user). */
export function indexAwaitingIntakeReviewByClient(
  interviews: (IntakeForReviewCheck & { userId: string })[],
  approvals: { interviewId: string; status: ApprovalStatus }[],
  waivedByClientId: Map<string, boolean>,
  assessmentCompletedByClientId: Map<string, boolean> = new Map(),
): Map<string, { awaiting: boolean; interviewId: string | null }> {
  const approvalByInterview = new Map(
    approvals.map((a) => [a.interviewId, { status: a.status }]),
  );

  const latestSubmittedByUser = new Map<string, IntakeForReviewCheck & { userId: string }>();

  for (const interview of interviews) {
    const submitted =
      interview.submittedAt != null ||
      interview.status === "SUBMITTED" ||
      interview.status === "COMPLETED";
    if (!submitted) continue;

    const existing = latestSubmittedByUser.get(interview.userId);
    if (!existing) {
      latestSubmittedByUser.set(interview.userId, interview);
    }
  }

  const result = new Map<string, { awaiting: boolean; interviewId: string | null }>();

  for (const [userId, interview] of latestSubmittedByUser) {
    const approval = approvalByInterview.get(interview.id) ?? null;
    const waived = waivedByClientId.get(userId) ?? false;
    const awaiting = isIntakeAwaitingAdvisorReview(interview, approval, waived, {
      assessmentCompleted: assessmentCompletedByClientId.get(userId) ?? false,
    });
    result.set(userId, { awaiting, interviewId: awaiting ? interview.id : null });
  }

  return result;
}

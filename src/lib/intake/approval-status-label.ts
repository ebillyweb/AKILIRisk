import type { ApprovalStatus } from "@prisma/client";

const APPROVAL_STATUS_LABELS: Record<ApprovalStatus, string> = {
  PENDING: "Pending review",
  IN_REVIEW: "Under review",
  APPROVED: "Approved",
  REJECTED: "Rejected",
};

/** Plain-English label for IntakeApproval.status (admin/advisor UI). */
export function formatIntakeApprovalStatus(
  status: string | null | undefined
): string {
  if (!status) return APPROVAL_STATUS_LABELS.PENDING;
  const normalized = status.toUpperCase() as ApprovalStatus;
  return APPROVAL_STATUS_LABELS[normalized] ?? status;
}

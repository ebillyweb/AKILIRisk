import type { PortfolioEngagementStatus } from "@prisma/client";

/**
 * BRD §6.3 / Epic 5.10 — Shared status display strings + badge variants
 * for the advisor engagement workspace and the client-facing dashboard
 * banner.
 */
export const ENGAGEMENT_STATUS_LABELS: Record<PortfolioEngagementStatus, string> = {
  ACCEPTED: "Accepted",
  MEETING_SCHEDULED: "Meeting scheduled",
  IN_PROGRESS: "In progress",
  COMPLETE: "Complete",
  DECLINED: "Declined",
};

export const ENGAGEMENT_STATUS_VARIANT: Record<
  PortfolioEngagementStatus,
  "default" | "secondary" | "success" | "warning" | "info" | "outline"
> = {
  ACCEPTED: "info",
  MEETING_SCHEDULED: "warning",
  IN_PROGRESS: "default",
  COMPLETE: "success",
  DECLINED: "outline",
};

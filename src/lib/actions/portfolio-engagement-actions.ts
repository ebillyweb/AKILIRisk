"use server";

/**
 * BRD §6.3 Phase 3 / Epic 5.10 — Portfolio engagement server actions.
 *
 * acceptRecommendation
 *   • Client-initiated. Creates the PortfolioEngagement row, transitions
 *     the source Assessment to deliverablePhase = PORTFOLIO, notifies the
 *     assigned advisor (notification dispatch is wired in a follow-up
 *     slice — this action just records the engagement and audit row).
 *   • Idempotent: re-calling for an assessment that already has an
 *     engagement returns the existing engagement rather than failing.
 *   • Refuses when the assessment is not in PROFILE phase, when the
 *     caller is not the assessment owner, or when no active advisor
 *     assignment exists.
 *
 * Payment model: none. Per BR-23, AKILI Risk Intelligence collects only
 * advisor subscriptions on Stripe; the advisor invoices the client
 * off-platform for the portfolio engagement.
 *
 * Status advancement (ACCEPTED → MEETING_SCHEDULED → IN_PROGRESS →
 * COMPLETE, or → DECLINED) is the advisor's responsibility and is
 * exposed through a separate advisor-only action in the same file.
 */

import { Prisma } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { enterPortfolio } from "@/lib/assessment/deliverable-phase";
import { AUDIT_ACTIONS, writeAudit } from "@/lib/audit/audit-log";
import {
  triggerEngagementAccepted,
  triggerMeetingScheduled,
} from "@/lib/notifications/deliverable-phase-triggers";

export type AcceptRecommendationInput = {
  assessmentId: string;
};

export type AcceptRecommendationResult =
  | { ok: true; engagementId: string; alreadyExisted: boolean }
  | { ok: false; code: "unauthenticated" | "forbidden" | "not_found" | "wrong_phase" | "no_advisor" };

export async function acceptRecommendation(
  input: AcceptRecommendationInput
): Promise<AcceptRecommendationResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, code: "unauthenticated" };
  }
  const clientId = session.user.id;

  const assessment = await prisma.assessment.findUnique({
    where: { id: input.assessmentId },
    select: {
      id: true,
      userId: true,
      deliverablePhase: true,
      portfolioEngagement: { select: { id: true } },
    },
  });
  if (!assessment) return { ok: false, code: "not_found" };
  if (assessment.userId !== clientId) return { ok: false, code: "forbidden" };
  if (assessment.deliverablePhase !== "PROFILE") {
    return { ok: false, code: "wrong_phase" };
  }
  if (assessment.portfolioEngagement) {
    return {
      ok: true,
      engagementId: assessment.portfolioEngagement.id,
      alreadyExisted: true,
    };
  }

  // Resolve the active advisor assignment for this client. The
  // ClientAdvisorAssignment.advisorId column references AdvisorProfile.id;
  // we need the AdvisorProfile's underlying User id to populate the
  // PortfolioEngagement.advisorId foreign key (which references User).
  const assignment = await prisma.clientAdvisorAssignment.findFirst({
    where: { clientId, status: "ACTIVE" },
    select: { advisor: { select: { userId: true } } },
  });
  if (!assignment?.advisor) return { ok: false, code: "no_advisor" };
  const advisorUserId = assignment.advisor.userId;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const now = new Date();
      const engagement = await tx.portfolioEngagement.create({
        data: {
          assessmentId: assessment.id,
          clientId,
          advisorId: advisorUserId,
          status: "ACCEPTED",
          acceptedAt: now,
        },
        select: { id: true },
      });
      await enterPortfolio(tx, assessment.id, now);
      return { engagementId: engagement.id };
    });

    void writeAudit({
      actor: {
        userId: clientId,
        role: session.user.role ?? "USER",
        email: session.user.email ?? "",
      },
      action: AUDIT_ACTIONS.PORTFOLIO_ENGAGEMENT_ACCEPT,
      entityType: "PortfolioEngagement",
      entityId: result.engagementId,
      metadata: {
        assessmentId: assessment.id,
        advisorId: advisorUserId,
      },
    });

    // BRD §6.3 / Epic 5.10 US-74: advisor notification on Phase 3 entry.
    void triggerEngagementAccepted(result.engagementId);

    return { ok: true, engagementId: result.engagementId, alreadyExisted: false };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      // Unique constraint on assessmentId raced with a concurrent accept.
      const existing = await prisma.portfolioEngagement.findUnique({
        where: { assessmentId: assessment.id },
        select: { id: true },
      });
      if (existing) {
        return { ok: true, engagementId: existing.id, alreadyExisted: true };
      }
    }
    throw e;
  }
}

// -----------------------------------------------------------------------------
// Advisor-side engagement-status advancement.
// -----------------------------------------------------------------------------

import type { PortfolioEngagementStatus } from "@prisma/client";

export type UpdateEngagementStatusInput = {
  engagementId: string;
  status: PortfolioEngagementStatus;
  meetingScheduledAt?: Date | null;
  meetingAt?: Date | null;
  notes?: string | null;
};

export type UpdateEngagementStatusResult =
  | { ok: true }
  | { ok: false; code: "unauthenticated" | "forbidden" | "not_found" | "invalid_status" };

const ALLOWED_TRANSITIONS: Record<
  PortfolioEngagementStatus,
  ReadonlySet<PortfolioEngagementStatus>
> = {
  ACCEPTED: new Set(["MEETING_SCHEDULED", "IN_PROGRESS", "DECLINED"]),
  MEETING_SCHEDULED: new Set(["IN_PROGRESS", "DECLINED", "ACCEPTED"]),
  IN_PROGRESS: new Set(["COMPLETE", "DECLINED"]),
  COMPLETE: new Set([]),
  DECLINED: new Set([]),
};

export async function updateEngagementStatus(
  input: UpdateEngagementStatusInput
): Promise<UpdateEngagementStatusResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, code: "unauthenticated" };
  if (session.user.role !== "ADVISOR" && session.user.role !== "ADMIN" && session.user.role !== "SUPER_ADMIN") {
    return { ok: false, code: "forbidden" };
  }

  const engagement = await prisma.portfolioEngagement.findUnique({
    where: { id: input.engagementId },
    select: { id: true, status: true, advisorId: true, assessmentId: true },
  });
  if (!engagement) return { ok: false, code: "not_found" };

  if (session.user.role === "ADVISOR" && engagement.advisorId !== session.user.id) {
    return { ok: false, code: "forbidden" };
  }

  const allowed = ALLOWED_TRANSITIONS[engagement.status];
  if (!allowed.has(input.status)) {
    return { ok: false, code: "invalid_status" };
  }

  const statusBefore = engagement.status;
  const now = new Date();
  const data: Prisma.PortfolioEngagementUpdateInput = { status: input.status };
  if (input.status === "MEETING_SCHEDULED" && input.meetingScheduledAt !== undefined) {
    data.meetingScheduledAt = input.meetingScheduledAt;
  }
  if (input.meetingAt !== undefined) data.meetingAt = input.meetingAt;
  if (input.notes !== undefined) data.notes = input.notes;
  if (input.status === "COMPLETE") data.completedAt = now;
  if (input.status === "DECLINED") data.declinedAt = now;

  await prisma.portfolioEngagement.update({
    where: { id: engagement.id },
    data,
  });

  void writeAudit({
    actor: {
      userId: session.user.id,
      role: session.user.role,
      email: session.user.email ?? "",
    },
    action: AUDIT_ACTIONS.PORTFOLIO_ENGAGEMENT_STATUS_UPDATE,
    entityType: "PortfolioEngagement",
    entityId: engagement.id,
    beforeData: { status: statusBefore },
    afterData: { status: input.status },
    metadata: { assessmentId: engagement.assessmentId },
  });

  // BRD §6.3 / Epic 5.10 US-75: notify the client when the advisor sets a meeting.
  if (input.status === "MEETING_SCHEDULED") {
    void triggerMeetingScheduled(engagement.id);
  }

  return { ok: true };
}

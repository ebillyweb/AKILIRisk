import "server-only";

import type { UserRole } from "@prisma/client";

import {
  resolveIncludedPillars,
} from "@/lib/assessment/included-pillars";
import { ensureScopedAssessmentForClient } from "@/lib/facilitated/bootstrap-assessment-from-approval";
import { approveIntakeWithDefaultPillars, canAdvisorSkipPostIntakeReview } from "@/lib/intake/auto-approve-default-pillars";
import { resolveEnterpriseMemberVisibilityContext } from "@/lib/enterprise/advisor-member-visibility";
import { getPlatformPillarCatalog } from "@/lib/methodology/cached-pillar-catalog";
import { prisma } from "@/lib/db";
import { writeAudit, AUDIT_ACTIONS } from "@/lib/audit/audit-log";

export async function advanceFacilitatedSessionWithDefaultPillars(input: {
  facilitatedSessionId: string;
  clientUserId: string;
  interviewId: string;
  advisorProfileId: string;
  actor: { userId: string; role: UserRole; email: string | null };
}): Promise<string | null> {
  const approved = await approveIntakeWithDefaultPillars({
    interviewId: input.interviewId,
    clientUserId: input.clientUserId,
    advisorProfileId: input.advisorProfileId,
  });
  if (!approved) {
    return null;
  }

  const catalog = await getPlatformPillarCatalog();
  const assessmentId = await ensureScopedAssessmentForClient(input.clientUserId, {
    includedPillars: approved.includedPillars,
    focusAreas: approved.focusAreas,
    source: "approval",
    approvalId: approved.approvalId,
  });

  await prisma.facilitatedSession.update({
    where: { id: input.facilitatedSessionId },
    data: { status: "ASSESSMENT", assessmentId },
  });

  await writeAudit({
    actor: input.actor,
    action: AUDIT_ACTIONS.FACILITATED_SESSION_SCOPE_SET,
    entityType: "FacilitatedSession",
    entityId: input.facilitatedSessionId,
    afterData: {
      includedPillars: approved.includedPillars,
      focusAreas: approved.focusAreas,
      assessmentId,
      skippedPostIntakeReview: true,
    },
    metadata: {
      clientId: input.clientUserId,
      facilitatedSessionId: input.facilitatedSessionId,
      interviewId: input.interviewId,
      approvalId: approved.approvalId,
    },
  });

  const firstPillar = resolveIncludedPillars(approved.includedPillars, catalog)[0];
  return `/advisor/facilitate/${input.facilitatedSessionId}/assessment/${firstPillar}/0`;
}

export async function tryAdvanceFacilitatedPastPostIntakeReview(input: {
  facilitatedSessionId: string;
  clientUserId: string;
  interviewId: string;
  advisorProfileId: string;
  advisorUserId: string;
  actor: { userId: string; role: UserRole; email: string | null };
}): Promise<string | null> {
  const visibility = await resolveEnterpriseMemberVisibilityContext(
    input.advisorUserId,
  );
  if (!canAdvisorSkipPostIntakeReview(visibility)) {
    return null;
  }

  return advanceFacilitatedSessionWithDefaultPillars(input);
}

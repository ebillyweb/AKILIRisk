import "server-only";

import type { UserRole } from "@prisma/client";
import { revalidatePath } from "next/cache";

import {
  createIntakeApproval,
  updateIntakeApproval,
} from "@/lib/data/advisor";
import { getIntakeInterview } from "@/lib/data/intake";
import { computePillarRecommendations } from "@/lib/intake/pillar-recommendations";
import { loadIntakeScriptQuestions } from "@/lib/intake/load-intake-script";
import {
  normalizeIncludedPillarIds,
} from "@/lib/assessment/included-pillars";
import { persistClientEngagementScope } from "@/lib/client/engagement-scope";
import {
  isEnterpriseMemberVisibilityEnabled,
  resolveEnterpriseMemberVisibilityContext,
} from "@/lib/enterprise/advisor-member-visibility";
import {
  assertAdvisorAssessmentDomainSelection,
  ensureAllPlatformPillarsActiveForAdvisor,
} from "@/lib/methodology/advisor-assessment-domains";
import { getPlatformPillarCatalog } from "@/lib/methodology/cached-pillar-catalog";
import { pillarCatalogSlugs } from "@/lib/methodology/pillar-catalog";
import { prisma } from "@/lib/db";
import { writeAudit, AUDIT_ACTIONS } from "@/lib/audit/audit-log";
import { notifyClientOfIntakeApproval } from "@/lib/intake/notify-client-intake-approved";
import { triggerMilestoneNotification } from "@/lib/notifications/triggers";
import { decryptUserEmail } from "@/lib/auth/user-email";

export function canAdvisorSkipPostIntakeReview(
  context: Awaited<ReturnType<typeof resolveEnterpriseMemberVisibilityContext>>,
): boolean {
  return isEnterpriseMemberVisibilityEnabled(context, "skipPostIntakeReview");
}

export type ApproveIntakeWithDefaultPillarsResult = {
  approvalId: string;
  includedPillars: string[];
  focusAreas: string[];
};

export async function approveIntakeWithDefaultPillars(input: {
  interviewId: string;
  clientUserId: string;
  advisorProfileId: string;
}): Promise<ApproveIntakeWithDefaultPillarsResult | null> {
  // Default engagement scope = full active platform catalog (not a legacy
  // six-domain subset). Activate any missing/inactive advisor overrides first
  // so validation against methodology succeeds.
  await ensureAllPlatformPillarsActiveForAdvisor(input.advisorProfileId);

  const catalog = await getPlatformPillarCatalog();
  const defaultPillars = pillarCatalogSlugs(catalog);
  if (defaultPillars.length === 0) {
    return null;
  }

  const normalizedIncluded = normalizeIncludedPillarIds(defaultPillars, catalog);
  const normalizedFocus = normalizedIncluded;

  await assertAdvisorAssessmentDomainSelection(
    input.advisorProfileId,
    normalizedIncluded,
  );

  const interview = await getIntakeInterview(
    input.clientUserId,
    input.interviewId,
  );
  if (!interview) {
    return null;
  }

  const script = await loadIntakeScriptQuestions();
  const pillarRecommendations = computePillarRecommendations(
    {
      questions: script.map((q) => ({
        id: q.id,
        questionText: q.questionText,
        relatedPillarIds: q.relatedPillarIds,
        recommendedActions: q.recommendedActions,
      })),
      responses: interview.responses.map((r) => ({
        questionId: r.questionId,
        transcription: r.transcription,
      })),
    },
    catalog,
  );

  const priorApproval = await createIntakeApproval(
    input.interviewId,
    input.advisorProfileId,
  );
  const approval = await updateIntakeApproval(priorApproval.id, {
    status: "APPROVED",
    includedPillars: normalizedIncluded,
    focusAreas: normalizedFocus,
    pillarRecommendations,
    approvedAt: new Date(),
  });

  await persistClientEngagementScope({
    clientId: input.clientUserId,
    includedPillars: normalizedIncluded,
    focusAreas: normalizedFocus,
    approvalId: approval.id,
  });

  return {
    approvalId: approval.id,
    includedPillars: normalizedIncluded,
    focusAreas: normalizedFocus,
  };
}

/**
 * After a client submits a self-service intake, auto-approve with default pillars
 * when the assigned advisor's firm allows skipping post-intake review.
 */
export async function tryAutoApproveSelfServiceIntakeAfterSubmit(
  interviewId: string,
  clientUserId: string,
): Promise<boolean> {
  const existingApproval = await prisma.intakeApproval.findFirst({
    where: { interviewId, status: "APPROVED" },
    select: { id: true },
  });
  if (existingApproval) {
    return true;
  }

  const assignment = await prisma.clientAdvisorAssignment.findFirst({
    where: { clientId: clientUserId, status: "ACTIVE" },
    orderBy: { assignedAt: "desc" },
    select: {
      advisorId: true,
      advisor: {
        select: {
          userId: true,
          user: {
            select: {
              role: true,
              emailCiphertext: true,
            },
          },
        },
      },
    },
  });
  if (!assignment) {
    return false;
  }

  const visibility = await resolveEnterpriseMemberVisibilityContext(
    assignment.advisor.userId,
  );
  if (!canAdvisorSkipPostIntakeReview(visibility)) {
    return false;
  }

  const approved = await approveIntakeWithDefaultPillars({
    interviewId,
    clientUserId,
    advisorProfileId: assignment.advisorId,
  });
  if (!approved) {
    return false;
  }

  const actor = {
    userId: assignment.advisor.userId,
    role: assignment.advisor.user.role as UserRole,
    email: decryptUserEmail(assignment.advisor.user.emailCiphertext),
  };

  await writeAudit({
    actor,
    action: AUDIT_ACTIONS.INTAKE_APPROVE,
    entityType: "IntakeApproval",
    entityId: approved.approvalId,
    afterData: {
      status: "APPROVED",
      includedPillars: approved.includedPillars,
      focusAreas: approved.focusAreas,
      skippedPostIntakeReview: true,
    },
    metadata: {
      interviewId,
      advisorId: assignment.advisorId,
      clientId: clientUserId,
    },
  });

  void notifyClientOfIntakeApproval({
    interviewId,
    advisorProfileId: assignment.advisorId,
    actor,
  });

  void triggerMilestoneNotification(clientUserId, "Intake Complete");

  revalidatePath("/advisor/review/[id]", "page");
  revalidatePath("/advisor");
  revalidatePath("/assessment", "layout");
  revalidatePath("/dashboard");
  revalidatePath("/intake", "layout");

  return true;
}

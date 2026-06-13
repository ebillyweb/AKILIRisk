"use server";

import type { UserRole } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { requireAdvisorRole, getAdvisorProfileOrThrow } from "@/lib/advisor/auth";
import {
  createIntakeApproval,
  updateIntakeApproval,
} from "@/lib/data/advisor";
import { computePillarRecommendations } from "@/lib/intake/pillar-recommendations";
import { loadIntakeScriptQuestions } from "@/lib/intake/load-intake-script";
import { getIntakeInterview } from "@/lib/data/intake";
import { normalizeIncludedPillarIds, resolveIncludedPillars } from "@/lib/assessment/included-pillars";
import { syncAssessmentScopeFromApproval } from "@/lib/assessment/sync-scope-from-approval";
import { prisma } from "@/lib/db";
import { approveClientSchema } from "@/lib/schemas/advisor";
import { writeAudit, AUDIT_ACTIONS } from "@/lib/audit/audit-log";
import { requireFacilitatedSessionForAdvisor } from "@/lib/facilitated/session-access";
import {
  ensureScopedAssessmentForClient,
} from "@/lib/facilitated/bootstrap-assessment-from-approval";

export async function facilitatedApproveScope(
  facilitatedSessionId: string,
  data: unknown,
) {
  try {
    const { userId, role, email } = await requireAdvisorRole();
    const profile = await getAdvisorProfileOrThrow(userId);
    const facilitated = await requireFacilitatedSessionForAdvisor(
      facilitatedSessionId,
    );
    if (facilitated.status !== "PILLAR_SELECT" || !facilitated.interviewId) {
      return {
        success: false as const,
        error: "Pillar selection is not available for this session",
      };
    }

    const parsed = approveClientSchema.safeParse({
      ...(typeof data === "object" && data !== null ? data : {}),
      interviewId: facilitated.interviewId,
    });
    if (!parsed.success) {
      return { success: false as const, errors: parsed.error.flatten().fieldErrors };
    }

    const { includedPillars, focusAreas, notes } = parsed.data;
    const normalizedIncluded = normalizeIncludedPillarIds(includedPillars);
    const normalizedFocus = focusAreas?.length
      ? normalizeIncludedPillarIds(focusAreas)
      : normalizedIncluded;

    const interview = await getIntakeInterview(
      facilitated.clientId,
      facilitated.interviewId,
    );
    if (!interview) {
      return { success: false as const, error: "Interview not found" };
    }

    const script = await loadIntakeScriptQuestions();
    const pillarRecommendations = computePillarRecommendations({
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
    });

    const priorApproval = await createIntakeApproval(
      facilitated.interviewId,
      profile.id,
    );
    const approval = await updateIntakeApproval(priorApproval.id, {
      status: "APPROVED",
      includedPillars: normalizedIncluded,
      focusAreas: normalizedFocus,
      pillarRecommendations,
      notes,
      approvedAt: new Date(),
    });

    await syncAssessmentScopeFromApproval(
      facilitated.clientId,
      approval.id,
      normalizedIncluded,
    );

    const assessmentId = await ensureScopedAssessmentForClient(facilitated.clientId, {
      includedPillars: normalizedIncluded,
      focusAreas: normalizedFocus,
      source: "approval",
      approvalId: approval.id,
    });

    await prisma.facilitatedSession.update({
      where: { id: facilitatedSessionId },
      data: { status: "ASSESSMENT", assessmentId },
    });

    await writeAudit({
      actor: { userId, role: role as UserRole, email: email ?? null },
      action: AUDIT_ACTIONS.FACILITATED_SESSION_SCOPE_SET,
      entityType: "FacilitatedSession",
      entityId: facilitatedSessionId,
      afterData: {
        includedPillars: normalizedIncluded,
        focusAreas: normalizedFocus,
        assessmentId,
      },
      metadata: {
        clientId: facilitated.clientId,
        facilitatedSessionId,
        interviewId: facilitated.interviewId,
        approvalId: approval.id,
      },
    });

    revalidatePath(`/advisor/facilitate/${facilitatedSessionId}/pillars`);
    revalidatePath("/assessment", "layout");

    const firstPillar = resolveIncludedPillars(normalizedIncluded)[0];
    return {
      success: true as const,
      redirectTo: `/advisor/facilitate/${facilitatedSessionId}/assessment/${firstPillar}/0`,
    };
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : "Failed to set scope",
    };
  }
}

export async function facilitatedGetPillarSelectContext(facilitatedSessionId: string) {
  try {
    await requireAdvisorRole();
    const facilitated = await requireFacilitatedSessionForAdvisor(
      facilitatedSessionId,
    );
    if (!facilitated.interviewId) {
      return { success: false as const, error: "Interview not found" };
    }
    const interview = await getIntakeInterview(
      facilitated.clientId,
      facilitated.interviewId,
    );
    if (!interview) {
      return { success: false as const, error: "Interview not found" };
    }
    const script = await loadIntakeScriptQuestions();
    const recommendations = computePillarRecommendations({
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
    });
    return {
      success: true as const,
      recommendations,
      clientName: facilitated.client.name,
    };
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : "Failed to load recommendations",
    };
  }
}

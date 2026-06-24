import "server-only";

import { prisma } from "@/lib/db";
import { isAdvisorHubNavRole } from "@/lib/auth-roles";
import { getFacilitatedSessionForAdvisor } from "@/lib/facilitated/session-access";

export type AssessmentApiAccess = {
  clientId: string;
  isFacilitated: boolean;
  facilitatedSessionId?: string;
};

/** Client owner or advisor via facilitated session may read/mutate an assessment. */
export async function authorizeAssessmentApiAccess(input: {
  assessmentId: string;
  userId: string;
  userRole?: string | null;
  facilitatedSessionId?: string | null;
}): Promise<AssessmentApiAccess | null> {
  const assessment = await prisma.assessment.findUnique({
    where: { id: input.assessmentId },
    select: { userId: true },
  });
  if (!assessment) return null;

  if (assessment.userId === input.userId) {
    return { clientId: assessment.userId, isFacilitated: false };
  }

  if (input.facilitatedSessionId && isAdvisorHubNavRole(input.userRole)) {
    const access = await resolveFacilitatedAssessmentAccess({
      facilitatedSessionId: input.facilitatedSessionId,
      advisorUserId: input.userId,
      assessmentId: input.assessmentId,
    });
    if (access) {
      return {
        clientId: access.clientId,
        isFacilitated: true,
        facilitatedSessionId: access.sessionId,
      };
    }
  }

  return null;
}

/** Verify advisor may mutate a client's assessment via facilitated session. */
export async function resolveFacilitatedAssessmentAccess(input: {
  facilitatedSessionId: string;
  advisorUserId: string;
  assessmentId: string;
}): Promise<{ clientId: string; sessionId: string } | null> {
  const session = await getFacilitatedSessionForAdvisor(
    input.facilitatedSessionId,
    input.advisorUserId,
  );
  if (!session) return null;
  if (session.status !== "ASSESSMENT" && session.status !== "PREVIEW") {
    return null;
  }
  if (session.assessmentId !== input.assessmentId) return null;

  const assessment = await prisma.assessment.findUnique({
    where: { id: input.assessmentId },
    select: { userId: true },
  });
  if (!assessment || assessment.userId !== session.clientId) return null;

  return { clientId: session.clientId, sessionId: session.id };
}

/**
 * Move a live session into PREVIEW only when every included pillar is scored
 * (`assessment.status === "COMPLETED"`). Do not use `deliverablePhase` — it
 * defaults to PREVIEW for in-progress assessments.
 */
export async function markFacilitatedSessionPreviewIfComplete(
  facilitatedSessionId: string,
): Promise<void> {
  const session = await prisma.facilitatedSession.findUnique({
    where: { id: facilitatedSessionId },
    select: {
      id: true,
      status: true,
      assessmentId: true,
    },
  });
  if (!session?.assessmentId || session.status !== "ASSESSMENT") return;

  const assessment = await prisma.assessment.findUnique({
    where: { id: session.assessmentId },
    select: { status: true },
  });
  if (assessment?.status !== "COMPLETED") return;

  await prisma.facilitatedSession.update({
    where: { id: facilitatedSessionId },
    data: { status: "PREVIEW" },
  });
}

/** Revert sessions wrongly promoted to PREVIEW while the assessment is still in progress. */
export async function reconcileMislabeledFacilitatedPreviewSessions(input: {
  advisorProfileId?: string;
  clientId?: string;
}): Promise<void> {
  const previewRows = await prisma.facilitatedSession.findMany({
    where: {
      ...(input.advisorProfileId ? { advisorProfileId: input.advisorProfileId } : {}),
      ...(input.clientId ? { clientId: input.clientId } : {}),
      status: "PREVIEW",
      assessmentId: { not: null },
    },
    select: { id: true, assessmentId: true },
  });
  if (previewRows.length === 0) return;

  const assessmentIds = [
    ...new Set(
      previewRows
        .map((row) => row.assessmentId)
        .filter((id): id is string => id != null),
    ),
  ];
  const assessments = await prisma.assessment.findMany({
    where: { id: { in: assessmentIds } },
    select: { id: true, status: true },
  });
  const statusById = new Map(assessments.map((row) => [row.id, row.status]));

  const sessionIdsToRevert = previewRows
    .filter(
      (row) =>
        row.assessmentId != null &&
        statusById.get(row.assessmentId) !== "COMPLETED",
    )
    .map((row) => row.id);
  if (sessionIdsToRevert.length === 0) return;

  await prisma.facilitatedSession.updateMany({
    where: { id: { in: sessionIdsToRevert } },
    data: { status: "ASSESSMENT" },
  });
}

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

export async function markFacilitatedSessionPreviewIfComplete(
  facilitatedSessionId: string,
): Promise<void> {
  const session = await prisma.facilitatedSession.findUnique({
    where: { id: facilitatedSessionId },
    select: {
      id: true,
      status: true,
      assessmentId: true,
      clientId: true,
    },
  });
  if (!session?.assessmentId || session.status !== "ASSESSMENT") return;

  const assessment = await prisma.assessment.findUnique({
    where: { id: session.assessmentId },
    select: { status: true, deliverablePhase: true },
  });
  if (
    assessment?.status === "COMPLETED" ||
    assessment?.deliverablePhase === "PREVIEW"
  ) {
    await prisma.facilitatedSession.update({
      where: { id: facilitatedSessionId },
      data: { status: "PREVIEW" },
    });
  }
}

import "server-only";

import type { FacilitatedSession } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  requireAdvisorRole,
  getAdvisorProfileOrThrow,
} from "@/lib/advisor/auth";
import {
  findPortfolioAssignmentForClient,
  resolvePortfolioScope,
} from "@/lib/enterprise/portfolio-access";

export type FacilitatedSessionContext = FacilitatedSession & {
  client: { id: string; name: string | null; emailCiphertext: string };
};

/** Load a session only when the advisor has portfolio access to the client. */
export async function getFacilitatedSessionForAdvisor(
  sessionId: string,
  advisorUserId: string,
): Promise<FacilitatedSessionContext | null> {
  const profile = await getAdvisorProfileOrThrow(advisorUserId);
  const scope = await resolvePortfolioScope(advisorUserId);
  if (!scope) return null;

  const session = await prisma.facilitatedSession.findUnique({
    where: { id: sessionId },
    include: {
      client: {
        select: { id: true, name: true, emailCiphertext: true },
      },
    },
  });
  if (!session) return null;
  if (session.advisorProfileId !== profile.id && scope.mode === "assigned") {
    return null;
  }

  const access = await findPortfolioAssignmentForClient(scope, session.clientId);
  if (!access) return null;

  return session;
}

export async function requireFacilitatedSessionForAdvisor(
  sessionId: string,
): Promise<FacilitatedSessionContext> {
  const { userId } = await requireAdvisorRole();
  const session = await getFacilitatedSessionForAdvisor(sessionId, userId);
  if (!session) {
    throw new Error("Session not found or not assigned to you");
  }
  return session;
}

export async function assertAdvisorPortfolioAccessToClient(
  advisorUserId: string,
  clientId: string,
): Promise<{ advisorProfileId: string }> {
  const profile = await getAdvisorProfileOrThrow(advisorUserId);
  const scope = await resolvePortfolioScope(advisorUserId);
  if (!scope) {
    throw new Error("Client not found or not assigned to you");
  }
  const access = await findPortfolioAssignmentForClient(scope, clientId);
  if (!access) {
    throw new Error("Client not found or not assigned to you");
  }
  return { advisorProfileId: profile.id };
}

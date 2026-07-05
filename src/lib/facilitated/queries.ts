import "server-only";

import type { FacilitatedSessionStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { userEmailForDisplay } from "@/lib/auth/user-email";
import { reconcileMislabeledFacilitatedPreviewSessions } from "@/lib/facilitated/assessment-access";
import { loadIntakeScriptForInterview } from "@/lib/intake/load-intake-script";
import {
  OPEN_FACILITATED_STATUSES,
  type FacilitatedSessionSummary,
} from "@/lib/facilitated/types";

const sessionSelect = {
  id: true,
  clientId: true,
  advisorProfileId: true,
  status: true,
  interviewId: true,
  assessmentId: true,
  startedAt: true,
  completedAt: true,
  client: {
    select: { name: true, emailCiphertext: true },
  },
} as const;

export async function findResumableFacilitatedSession(input: {
  clientId: string;
  advisorProfileId: string;
}): Promise<FacilitatedSessionSummary | null> {
  await reconcileMislabeledFacilitatedPreviewSessions({
    advisorProfileId: input.advisorProfileId,
    clientId: input.clientId,
  });

  const session = await prisma.facilitatedSession.findFirst({
    where: {
      clientId: input.clientId,
      advisorProfileId: input.advisorProfileId,
      status: { in: OPEN_FACILITATED_STATUSES },
    },
    orderBy: { startedAt: "desc" },
    select: sessionSelect,
  });
  return session ? mapSessionSummary(session) : null;
}

export async function listOpenFacilitatedSessionsForAdvisor(
  advisorProfileId: string,
  limit = 50,
): Promise<FacilitatedSessionSummary[]> {
  await reconcileMislabeledFacilitatedPreviewSessions({ advisorProfileId });

  const rows = await prisma.facilitatedSession.findMany({
    where: {
      advisorProfileId,
      status: { in: OPEN_FACILITATED_STATUSES },
    },
    orderBy: { updatedAt: "desc" },
    take: limit,
    select: sessionSelect,
  });
  return enrichFacilitatedSessionSummaries(rows.map(mapSessionSummary));
}

async function enrichFacilitatedSessionSummaries(
  sessions: FacilitatedSessionSummary[],
): Promise<FacilitatedSessionSummary[]> {
  return Promise.all(
    sessions.map(async (session) => ({
      ...session,
      progressDetail: await resolveFacilitatedSessionProgressDetail(session),
    })),
  );
}

async function resolveFacilitatedSessionProgressDetail(
  session: FacilitatedSessionSummary,
): Promise<string | null> {
  switch (session.status) {
    case "INTAKE": {
      if (!session.interviewId) return null;
      const [interview, questions] = await Promise.all([
        prisma.intakeInterview.findUnique({
          where: { id: session.interviewId },
          select: { currentQuestionIndex: true },
        }),
        loadIntakeScriptForInterview(session.interviewId),
      ]);
      if (!interview || questions.length === 0) return null;
      const maxIdx = Math.max(0, questions.length - 1);
      const idx = Math.min(interview.currentQuestionIndex ?? 0, maxIdx);
      return `Question ${idx + 1} of ${questions.length}`;
    }
    case "PILLAR_SELECT":
      return "Choosing assessment pillars";
    case "ASSESSMENT":
      return "Assessment in progress";
    default:
      return null;
  }
}

/** @deprecated Use listOpenFacilitatedSessionsForAdvisor */
export const listRecentFacilitatedSessionsForAdvisor = listOpenFacilitatedSessionsForAdvisor;

function mapSessionSummary(
  row: {
    id: string;
    clientId: string;
    advisorProfileId: string;
    status: FacilitatedSessionStatus;
    interviewId: string | null;
    assessmentId: string | null;
    startedAt: Date;
    completedAt: Date | null;
    client: { name: string | null; emailCiphertext: string };
  },
): FacilitatedSessionSummary {
  return {
    id: row.id,
    clientId: row.clientId,
    advisorProfileId: row.advisorProfileId,
    status: row.status,
    interviewId: row.interviewId,
    assessmentId: row.assessmentId,
    startedAt: row.startedAt,
    completedAt: row.completedAt,
    clientName: row.client.name,
    clientEmail: userEmailForDisplay(row.client),
    progressDetail: null,
    clientDisplayName: "Client",
    clientDisplayPseudonymous: true,
  };
}

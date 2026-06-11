import "server-only";

import { notFound, redirect } from "next/navigation";

import { getFacilitatedSessionForAdvisor } from "@/lib/facilitated/session-access";
import { facilitatedSessionStepPath } from "@/lib/facilitated/types";
import type { FacilitatedSessionStatus } from "@prisma/client";

export async function assertFacilitatedSessionStep(
  sessionId: string,
  advisorUserId: string,
  expectedStatuses: FacilitatedSessionStatus[],
) {
  const facilitated = await getFacilitatedSessionForAdvisor(sessionId, advisorUserId);
  if (!facilitated) notFound();
  if (!expectedStatuses.includes(facilitated.status)) {
    redirect(facilitatedSessionStepPath(sessionId, facilitated.status));
  }
  return facilitated;
}

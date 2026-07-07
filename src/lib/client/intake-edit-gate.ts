import "server-only";

import { prisma } from "@/lib/db";

/** True when the client has an assessment in progress or completed. */
export async function hasClientAssessmentStarted(
  clientUserId: string,
): Promise<boolean> {
  const assessment = await prisma.assessment.findFirst({
    where: {
      userId: clientUserId,
      status: { in: ["IN_PROGRESS", "COMPLETED"] },
    },
    select: { id: true },
  });
  return assessment != null;
}

export type IntakeAnswersEditableResult =
  | { ok: true }
  | { ok: false; error: string };

/** Clients may not change intake answers once an assessment has started. */
export async function assertClientIntakeAnswersEditable(
  clientUserId: string,
): Promise<IntakeAnswersEditableResult> {
  if (await hasClientAssessmentStarted(clientUserId)) {
    return {
      ok: false,
      error:
        "Intake answers cannot be changed after your assessment has started.",
    };
  }
  return { ok: true };
}

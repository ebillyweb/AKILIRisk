import "server-only";

import { prisma } from "@/lib/db";

function isSubmittedIntake(status: string, submittedAt: Date | null): boolean {
  return (
    submittedAt != null || status === "SUBMITTED" || status === "COMPLETED"
  );
}

/**
 * Intake sometimes completes while the session user is the advisor (not the
 * client). Those rows keep `userId` on the advisor User until reassigned.
 * When there is exactly one active assignment whose client has no submitted
 * intake yet, move ownership to that client so advisor review + pipeline work.
 *
 * Mirrors `scripts/migrate-intake-to-client.js` (safe, automatic, unambiguous only).
 */
export async function maybeReassignMisplacedIntakeToClient(
  interviewId: string,
  advisorProfileId: string,
  advisorUserId: string,
): Promise<boolean> {
  const interview = await prisma.intakeInterview.findUnique({
    where: { id: interviewId },
    select: {
      id: true,
      userId: true,
      status: true,
      submittedAt: true,
      user: { select: { role: true } },
    },
  });

  if (!interview) return false;
  if (!isSubmittedIntake(interview.status, interview.submittedAt)) return false;
  if (interview.user.role === "USER") return false;
  if (interview.userId !== advisorUserId) return false;

  const candidates = await prisma.clientAdvisorAssignment.findMany({
    where: {
      advisorId: advisorProfileId,
      status: "ACTIVE",
      client: {
        role: "USER",
        intakeInterviews: {
          none: {
            OR: [{ status: "SUBMITTED" }, { submittedAt: { not: null } }],
          },
        },
      },
    },
    orderBy: { assignedAt: "desc" },
    select: { clientId: true },
  });

  if (candidates.length !== 1) return false;

  await prisma.intakeInterview.update({
    where: { id: interviewId },
    data: { userId: candidates[0].clientId },
  });

  return true;
}

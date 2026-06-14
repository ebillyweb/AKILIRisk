import "server-only";

import { prisma } from "@/lib/db";

/**
 * Verifies the advisor (by user id) is actively assigned to the client and
 * returns the client + their latest interview. Returns null if not assigned —
 * the single enforcement point for advisor→client tenant isolation on mobile.
 */
export async function getAssignedClientIntake(advisorUserId: string, clientId: string) {
  const profile = await prisma.advisorProfile.findUnique({
    where: { userId: advisorUserId },
    select: { id: true },
  });
  if (!profile) return null;

  const assignment = await prisma.clientAdvisorAssignment.findFirst({
    where: { advisorId: profile.id, clientId, status: "ACTIVE" },
    select: { id: true },
  });
  if (!assignment) return null;

  const client = await prisma.user.findUnique({
    where: { id: clientId },
    select: {
      id: true,
      name: true,
      email: true,
      intakeInterviews: {
        orderBy: { updatedAt: "desc" },
        take: 1,
        select: {
          id: true,
          status: true,
          submittedAt: true,
          responses: true,
        },
      },
    },
  });
  if (!client) return null;

  return { client, interview: client.intakeInterviews[0] ?? null };
}

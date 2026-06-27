import "server-only";

import { prisma } from "@/lib/db";
import { userEmailForDisplay } from "@/lib/auth/user-email";
import { sendAdvisorIntakeNotification } from "@/lib/email";
import { createNotification } from "@/lib/data/advisor";
import { triggerMilestoneNotification } from "@/lib/notifications/triggers";

/**
 * Notifies every advisor actively assigned to the client who owns `interviewId`
 * that their intake is ready for review: an in-app notification + an email per
 * advisor, plus a milestone trigger. Per-advisor failures are isolated so one
 * bad address never blocks the others. Returns the number notified.
 *
 * Shared by the mobile submit endpoint and the web notify-advisor route.
 */
export async function notifyAdvisorsOfIntakeSubmission(
  interviewId: string,
): Promise<number> {
  const interview = await prisma.intakeInterview.findUnique({
    where: { id: interviewId },
    include: { user: { select: { id: true, name: true, emailCiphertext: true } } },
  });
  if (!interview) return 0;

  const assignments = await prisma.clientAdvisorAssignment.findMany({
    where: { clientId: interview.userId, status: "ACTIVE" },
    include: {
      advisor: {
        include: { user: { select: { id: true, name: true, emailCiphertext: true } } },
      },
    },
  });

  const clientName = interview.user.name || "Client";
  let notified = 0;

  for (const assignment of assignments) {
    const advisor = assignment.advisor;
    try {
      await createNotification(
        advisor.id,
        "NEW_INTAKE",
        `New Intake: ${clientName}`,
        `${clientName} has completed their intake interview and is ready for review.`,
        interviewId,
      );

      const reviewUrl = `${process.env.NEXTAUTH_URL || "http://localhost:3000"}/advisor/review/${interviewId}`;
      await sendAdvisorIntakeNotification(
        userEmailForDisplay(advisor.user),
        advisor.user.name || "Advisor",
        clientName,
        userEmailForDisplay(interview.user),
        reviewUrl,
      );
      notified += 1;
    } catch (error) {
      console.error(`Failed to notify advisor ${advisor.id}:`, error);
    }
  }

  // Fire-and-forget milestone trigger (matches the web notify-advisor route).
  void triggerMilestoneNotification(interview.userId, "Intake Complete");

  return notified;
}

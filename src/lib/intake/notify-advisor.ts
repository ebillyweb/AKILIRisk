import "server-only";

import { prisma } from "@/lib/db";
import { sendAdvisorIntakeNotification } from "@/lib/email";
import { createNotification } from "@/lib/data/advisor";
import { triggerMilestoneNotification } from "@/lib/notifications/triggers";
import { getPublicAppUrlStrict } from "@/lib/public-app-url";

/**
 * Notify every advisor with an ACTIVE assignment to the intake's owning
 * client that the intake is ready for review. Used by the "submit
 * intake" server action and by the `/api/intake/[id]/notify-advisor`
 * route.
 *
 * Returns the number of advisors successfully notified. Per-advisor
 * failures are logged and do not abort the loop — one bad mailbox
 * shouldn't block the rest. URL composition uses the strict env-only
 * resolver: in production with no AUTH_URL/NEXT_PUBLIC_URL/NEXTAUTH_URL/
 * VERCEL_URL, we skip the email body's review URL rather than emit a
 * localhost link.
 */
export async function notifyAdvisorsOfIntake(
  interviewId: string
): Promise<{ notifiedCount: number }> {
  const interview = await prisma.intakeInterview.findUnique({
    where: { id: interviewId },
    include: {
      user: { select: { id: true, name: true, email: true } },
    },
  });
  if (!interview) {
    return { notifiedCount: 0 };
  }

  const assignments = await prisma.clientAdvisorAssignment.findMany({
    where: { clientId: interview.userId, status: "ACTIVE" },
    include: {
      advisor: {
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
      },
    },
  });

  // Strict env-only resolver — see comment in getPublicAppUrlStrict. Null
  // here means "we don't have a usable public origin in prod"; we still
  // fire the in-app notification and milestone trigger, but skip the
  // outbound email (a localhost link is worse than no email).
  const baseUrl = getPublicAppUrlStrict();
  if (!baseUrl) {
    console.error(
      "notifyAdvisorsOfIntake: no public app URL configured; skipping email send"
    );
  }

  let notifiedCount = 0;
  for (const assignment of assignments) {
    const advisor = assignment.advisor;
    const advisorUser = advisor.user;
    try {
      await createNotification(
        advisor.id,
        "NEW_INTAKE",
        `New Intake: ${interview.user.name}`,
        `${interview.user.name} has completed their intake interview and is ready for review.`,
        interviewId
      );

      if (baseUrl) {
        const reviewUrl = `${baseUrl}/advisor/review/${interviewId}`;
        await sendAdvisorIntakeNotification(
          advisorUser.email,
          advisorUser.name || "Advisor",
          interview.user.name || "Client",
          interview.user.email,
          reviewUrl
        );
      }

      notifiedCount++;
    } catch (e) {
      console.error(`Failed to notify advisor ${advisor.id}:`, e);
    }
  }

  // Fire-and-forget; this trigger has its own internal error handling.
  void triggerMilestoneNotification(interview.userId, "Intake Complete");

  return { notifiedCount };
}

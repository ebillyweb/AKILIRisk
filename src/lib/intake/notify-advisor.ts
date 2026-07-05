import "server-only";

import { prisma } from "@/lib/db";
import { sendAdvisorIntakeNotification } from "@/lib/email";
import { createNotification } from "@/lib/data/advisor";
import { triggerMilestoneNotification } from "@/lib/notifications/triggers";
import { getPublicAppUrlStrict } from "@/lib/public-app-url";
import { decryptUserEmail } from "@/lib/auth/user-email";
import {
  loadAdvisorPiiPolicy,
} from "@/lib/advisor/field-visibility";
import { resolveAdvisorClientPipelineLabels } from "@/lib/pipeline/client-display";
import { resolveClientReferenceCode } from "@/lib/client/client-reference-code.server";
import { safeDecryptUserName } from "@/lib/data/client-pii";

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
  // Round-11 commit 2.4b: ciphertext, decrypt at usage.
  const interview = await prisma.intakeInterview.findUnique({
    where: { id: interviewId },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          emailCiphertext: true,
          clientReferenceCode: true,
        },
      },
    },
  });
  if (!interview) {
    return { notifiedCount: 0 };
  }

  const assignments = await prisma.clientAdvisorAssignment.findMany({
    where: { clientId: interview.userId, status: "ACTIVE" },
    select: {
      id: true,
      advisorId: true,
      fieldVisibility: true,
      advisor: {
        select: {
          id: true,
          piiPolicy: true,
          user: { select: { id: true, name: true, emailCiphertext: true } },
        },
      },
    },
  });
  const clientEmail = decryptUserEmail(interview.user.emailCiphertext);
  const decryptedClientName = safeDecryptUserName(interview.user.name, {
    rowId: interview.user.id,
  });
  const clientReferenceCode = await resolveClientReferenceCode(
    interview.user.id,
    interview.user.clientReferenceCode,
  );

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
    const advisorPolicy = await loadAdvisorPiiPolicy(advisor.id);
    const labels = resolveAdvisorClientPipelineLabels({
      id: interview.user.id,
      name: decryptedClientName,
      email: clientEmail,
      clientReferenceCode,
      pseudonymousWorkspaceLabeling: advisorPolicy.pseudonymousWorkspaceLabeling,
    });
    const clientDisplayName = labels.headline;
    const includeClientEmailInNotification = !labels.pseudonymous;
    try {
      await createNotification(
        advisor.id,
        "NEW_INTAKE",
        `New Intake: ${clientDisplayName}`,
        `${clientDisplayName} has completed their intake interview and is ready for review.`,
        interviewId
      );

      if (baseUrl) {
        const reviewUrl = `${baseUrl}/advisor/review/${interviewId}`;
        await sendAdvisorIntakeNotification(
          decryptUserEmail(advisorUser.emailCiphertext),
          advisorUser.name || "Advisor",
          clientDisplayName,
          includeClientEmailInNotification ? clientEmail : null,
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

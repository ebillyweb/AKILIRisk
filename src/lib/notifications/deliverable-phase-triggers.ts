import "server-only";

/**
 * BRD §6.3 / Epic 5.10 — Deliverable-phase notification triggers.
 */

import { prisma } from "@/lib/db";
import { sendNotification } from "@/lib/notifications/service";
import { decryptUserEmail } from "@/lib/auth/user-email";
import { resolveClientEmailContext, type ClientEmailContext } from "@/lib/client/client-email-context";
import {
  buildMeetingScheduledClientEmail,
  buildPreviewAvailableClientEmail,
  buildProfilePublishedClientEmail,
} from "@/lib/client/client-system-email-content";
import { sendClientSystemEmail } from "@/lib/email/client-branded-system-email";

async function sendBrandedClientMilestoneEmail(
  userId: string,
  clientEmail: string,
  buildContent: (
    context: ClientEmailContext | null,
  ) => Parameters<typeof sendClientSystemEmail>[1],
): Promise<void> {
  const context = await resolveClientEmailContext({ userId, email: clientEmail });
  const result = await sendClientSystemEmail(
    clientEmail,
    buildContent(context),
    context,
  );
  if (!result.sent) {
    console.error(
      `Client milestone email not sent to ${clientEmail}:`,
      "reason" in result ? result.reason : "unknown",
    );
  }
}

/**
 * Phase 1 entry: questionnaire complete, RISK PREVIEW available.
 */
export async function triggerPreviewAvailable(assessmentId: string): Promise<void> {
  try {
    const assessment = await prisma.assessment.findUnique({
      where: { id: assessmentId },
      select: {
        id: true,
        userId: true,
        user: { select: { name: true, emailCiphertext: true } },
      },
    });
    if (!assessment) return;

    const clientName = assessment.user.name ?? null;
    const clientEmail = decryptUserEmail(assessment.user.emailCiphertext);

    await sendBrandedClientMilestoneEmail(
      assessment.userId,
      clientEmail,
      (context) => buildPreviewAvailableClientEmail(context, clientName),
    );

    const assignment = await prisma.clientAdvisorAssignment.findFirst({
      where: { clientId: assessment.userId, status: "ACTIVE" },
      select: {
        advisor: {
          select: {
            id: true,
            user: { select: { id: true, emailCiphertext: true } },
          },
        },
      },
    });
    if (assignment?.advisor) {
      await sendNotification({
        recipientUserId: assignment.advisor.user.id,
        recipientEmail: decryptUserEmail(assignment.advisor.user.emailCiphertext),
        category: "milestone",
        title: "Questionnaire complete — Preview available",
        message: `${clientName ?? "Your client"} has completed their questionnaire. The 48-hour Risk Profile delivery window has started.`,
        referenceId: assessment.id,
        advisorProfileId: assignment.advisor.id,
      });
    }
  } catch (error) {
    console.error("triggerPreviewAvailable failed:", error);
  }
}

/**
 * Phase 2 entry: RISK PROFILE published. Sent to the client.
 */
export async function triggerProfilePublished(assessmentId: string): Promise<void> {
  try {
    const assessment = await prisma.assessment.findUnique({
      where: { id: assessmentId },
      select: {
        id: true,
        userId: true,
        user: { select: { name: true, emailCiphertext: true } },
      },
    });
    if (!assessment) return;

    const clientName = assessment.user.name ?? null;
    const clientEmail = decryptUserEmail(assessment.user.emailCiphertext);

    await sendBrandedClientMilestoneEmail(
      assessment.userId,
      clientEmail,
      (context) => buildProfilePublishedClientEmail(context, clientName),
    );
  } catch (error) {
    console.error("triggerProfilePublished failed:", error);
  }
}

/**
 * Phase 3 entry: client accepted the recommendation. Sent to the advisor.
 */
export async function triggerEngagementAccepted(engagementId: string): Promise<void> {
  try {
    const engagement = await prisma.portfolioEngagement.findUnique({
      where: { id: engagementId },
      select: {
        id: true,
        assessmentId: true,
        client: { select: { name: true } },
        advisorId: true,
      },
    });
    if (!engagement) return;

    const advisor = await prisma.user.findUnique({
      where: { id: engagement.advisorId },
      select: {
        id: true,
        emailCiphertext: true,
        advisorProfile: { select: { id: true } },
      },
    });
    if (!advisor?.advisorProfile) return;

    const clientName = engagement.client.name ?? "Your client";

    await sendNotification({
      recipientUserId: advisor.id,
      recipientEmail: decryptUserEmail(advisor.emailCiphertext),
      category: "milestone",
      title: "Client accepted the recommendation",
      message: `${clientName} has accepted the recommendation. Please follow up to schedule a Risk Portfolio meeting.`,
      referenceId: engagement.id,
      advisorProfileId: advisor.advisorProfile.id,
    });
  } catch (error) {
    console.error("triggerEngagementAccepted failed:", error);
  }
}

/**
 * Status update: advisor set MEETING_SCHEDULED on an engagement.
 */
export async function triggerMeetingScheduled(engagementId: string): Promise<void> {
  try {
    const engagement = await prisma.portfolioEngagement.findUnique({
      where: { id: engagementId },
      select: {
        id: true,
        meetingScheduledAt: true,
        meetingAt: true,
        client: { select: { id: true, name: true, emailCiphertext: true } },
      },
    });
    if (!engagement) return;

    const clientName = engagement.client.name ?? null;
    const clientEmail = decryptUserEmail(engagement.client.emailCiphertext);
    const meetingAt = engagement.meetingAt ?? engagement.meetingScheduledAt;
    const meetingDate = meetingAt
      ? meetingAt.toISOString().split("T")[0]
      : null;

    await sendBrandedClientMilestoneEmail(
      engagement.client.id,
      clientEmail,
      (context) =>
        buildMeetingScheduledClientEmail(context, clientName, meetingDate),
    );
  } catch (error) {
    console.error("triggerMeetingScheduled failed:", error);
  }
}

/**
 * SLA nudge: advisor has not delivered the RISK PROFILE within 44 hours.
 */
export async function triggerAdvisoryOutreachReminder(assessmentId: string): Promise<void> {
  try {
    const assessment = await prisma.assessment.findUnique({
      where: { id: assessmentId },
      select: {
        id: true,
        userId: true,
        previewEnteredAt: true,
        deliverablePhase: true,
        user: { select: { name: true } },
      },
    });
    if (!assessment) return;
    if (assessment.deliverablePhase !== "PREVIEW") return;
    if (!assessment.previewEnteredAt) return;

    const assignment = await prisma.clientAdvisorAssignment.findFirst({
      where: { clientId: assessment.userId, status: "ACTIVE" },
      select: {
        advisor: {
          select: {
            id: true,
            user: { select: { id: true, emailCiphertext: true } },
          },
        },
      },
    });
    if (!assignment?.advisor) return;

    const clientName = assessment.user.name ?? "your client";

    await sendNotification({
      recipientUserId: assignment.advisor.user.id,
      recipientEmail: decryptUserEmail(assignment.advisor.user.emailCiphertext),
      category: "reminder",
      title: "Risk Profile delivery due soon",
      message: `The 48-hour Risk Profile delivery window for ${clientName} is approaching. Please publish their report.`,
      referenceId: assessment.id,
      advisorProfileId: assignment.advisor.id,
    });
  } catch (error) {
    console.error("triggerAdvisoryOutreachReminder failed:", error);
  }
}

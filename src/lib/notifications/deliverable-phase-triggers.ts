import "server-only";

/**
 * BRD §6.3 / Epic 5.10 — Deliverable-phase notification triggers.
 *
 * Five notifications fire across the PREVIEW / PROFILE / PORTFOLIO
 * lifecycle. All are fire-and-forget: a dispatch failure must never roll
 * back the underlying transition. Callers wrap each invocation in `void`
 * so the promise rejection is suppressed at the call site (the trigger
 * itself swallows and logs).
 *
 * Channel routing:
 *   • Client recipients receive email only (clients have no in-app
 *     notification surface today; that ships with Slice B).
 *   • Advisor recipients receive email + in-app via the existing
 *     advisor-notification pipeline (`sendNotification` with
 *     `advisorProfileId`).
 *
 * Preference categories are reused from the existing taxonomy:
 *   • 'milestone' for phase entry events (PREVIEW available, PROFILE
 *     published, ENGAGEMENT_ACCEPTED for the advisor, meeting scheduled
 *     for the client).
 *   • 'reminder'  for the 44-hour advisory-outreach SLA nudge.
 */

import { prisma } from "@/lib/db";
import { sendNotification } from "@/lib/notifications/service";
import { decryptUserEmail } from "@/lib/auth/user-email";

/**
 * Phase 1 entry: questionnaire complete, RISK PREVIEW available.
 * Sent to the client. When an advisor completed the questionnaire on the
 * client's behalf the advisor also receives a copy.
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

    const clientName = assessment.user.name ?? "you";
    const clientEmail = decryptUserEmail(assessment.user.emailCiphertext);

    // Client email.
    await sendNotification({
      recipientUserId: assessment.userId,
      recipientEmail: clientEmail,
      category: "milestone",
      title: "Your Risk Preview is ready",
      message:
        `${clientName === "you" ? "Your" : `${clientName}'s`} questionnaire is complete and a Risk Preview is now viewable. ` +
        "The advisory team will be in touch within 48 hours with your customized Risk Profile.",
      referenceId: assessment.id,
    });

    // If the assigned advisor is distinct from the client (always true),
    // surface the milestone on their in-app pipeline + email too.
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
        message: `${clientName} has completed their questionnaire. The 48-hour Risk Profile delivery window has started.`,
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

    const clientName = assessment.user.name ?? "you";
    const clientEmail = decryptUserEmail(assessment.user.emailCiphertext);

    await sendNotification({
      recipientUserId: assessment.userId,
      recipientEmail: clientEmail,
      category: "milestone",
      title: "Your Risk Profile is ready",
      message:
        `${clientName === "you" ? "Your" : `${clientName}'s`} customized Risk Profile has been delivered by the advisory team. ` +
        "Sign in to review the detailed results and recommended plan.",
      referenceId: assessment.id,
    });
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

    // PortfolioEngagement.advisorId references User.id, but in-app
    // notifications are keyed by AdvisorProfile.id. Resolve via the
    // advisor's AdvisorProfile.
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
 * Status update: advisor set MEETING_SCHEDULED on an engagement. Sent to
 * the client so they can see the meeting on their dashboard.
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

    const clientName = engagement.client.name ?? "you";
    const clientEmail = decryptUserEmail(engagement.client.emailCiphertext);
    const meetingAt = engagement.meetingAt ?? engagement.meetingScheduledAt;
    const meetingNote = meetingAt
      ? ` Your meeting is scheduled for ${meetingAt.toISOString().split("T")[0]}.`
      : "";

    await sendNotification({
      recipientUserId: engagement.client.id,
      recipientEmail: clientEmail,
      category: "milestone",
      title: "Your Portfolio meeting is scheduled",
      message:
        `${clientName === "you" ? "Your" : `${clientName}'s`} advisor has scheduled a meeting to discuss the Risk Portfolio.` +
        meetingNote,
      referenceId: engagement.id,
    });
  } catch (error) {
    console.error("triggerMeetingScheduled failed:", error);
  }
}

/**
 * SLA nudge: advisor has not delivered the RISK PROFILE within 44 hours
 * of the PREVIEW becoming available. Sent to the assigned advisor.
 *
 * The cron job that calls this lands in Slice C. The trigger itself is
 * defined here so the dispatch surface is uniform across phase events.
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
    if (assessment.deliverablePhase !== "PREVIEW") return; // moved on already
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

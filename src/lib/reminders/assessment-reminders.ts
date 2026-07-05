import "server-only";

import { prisma } from "@/lib/db";
import { shouldSendNotification } from "@/lib/notifications/preferences";
import { decryptUserEmail } from "@/lib/auth/user-email";
import { resolveClientEmailContext, clientPortalUrl } from "@/lib/client/client-email-context";
import { buildAssessmentReminderClientEmail } from "@/lib/client/client-system-email-content";
import { sendClientSystemEmail } from "@/lib/email/client-branded-system-email";
import { getPublicAppUrlStrict } from "@/lib/public-app-url";

interface ProcessResult {
  clientsReminded: number;
}

/**
 * Processes assessment reminders for clients with incomplete assessments or intakes.
 *
 * Logic:
 * - Finds clients with IntakeInterview IN_PROGRESS >7 days old OR Assessment IN_PROGRESS >14 days old
 * - Checks notification preferences for each client
 * - Prevents duplicate reminders within user-configured frequency window (default 7 days)
 * - Sends reminder emails to CLIENTS (not advisors)
 * - Uses assessment reminder email template
 *
 * Returns summary of processing results.
 */
export async function processAssessmentReminders(): Promise<ProcessResult> {
  let clientsReminded = 0;

  const appUrl = getPublicAppUrlStrict();
  if (!appUrl) {
    console.error(
      "Assessment reminders skipped: public app URL not configured (AUTH_URL / NEXT_PUBLIC_URL)."
    );
    return { clientsReminded: 0 };
  }

  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 days for intake
    const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000); // 14 days for assessment

    // Find client assignments with stalled intakes or assessments
    const stalledClients = await prisma.clientAdvisorAssignment.findMany({
      where: {
        OR: [
          {
            // Stalled intake interviews (IN_PROGRESS >7 days)
            client: {
              intakeInterviews: {
                some: {
                  status: 'IN_PROGRESS',
                  updatedAt: {
                    lt: sevenDaysAgo,
                  },
                },
              },
            },
          },
          {
            // Stalled assessments (IN_PROGRESS >14 days)
            client: {
              assessments: {
                some: {
                  status: 'IN_PROGRESS',
                  updatedAt: {
                    lt: fourteenDaysAgo,
                  },
                },
              },
            },
          },
        ],
      },
      include: {
        client: {
          select: {
            id: true,
            // Round-11 commit 2.4b: ciphertext, decrypt at usage.
            emailCiphertext: true,
            name: true,
            firstName: true,
            lastName: true,
            intakeInterviews: {
              select: {
                status: true,
                updatedAt: true,
              },
              orderBy: {
                updatedAt: 'desc',
              },
              take: 1,
            },
            assessments: {
              select: {
                status: true,
                updatedAt: true,
              },
              orderBy: {
                updatedAt: 'desc',
              },
              take: 1,
            },
          },
        },
        advisor: {
          select: {
            id: true,
            firmName: true,
            logoUrl: true,
            user: {
              select: {
                name: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
    });

    for (const assignment of stalledClients) {
      try {
        const client = assignment.client;
        const advisor = assignment.advisor;

        // Check if we should send notification based on preferences
        const shouldSend = await shouldSendNotification(client.id, 'reminder', 'email');
        if (!shouldSend) {
          continue;
        }

        // Check for recent reminders to prevent spam
        // Use the user's reminder frequency preference, default to 7 days
        const userPreferences = await prisma.notificationPreference.findUnique({
          where: { userId: client.id },
          select: { reminderFrequencyDays: true },
        });

        const frequencyDays = userPreferences?.reminderFrequencyDays ?? 7;
        const frequencyCutoff = new Date(Date.now() - frequencyDays * 24 * 60 * 60 * 1000);

        // Check for recent reminder notifications to this client
        const recentReminder = await prisma.advisorNotification.findFirst({
          where: {
            type: 'SYSTEM',
            referenceId: client.id,
            createdAt: {
              gte: frequencyCutoff,
            },
          },
        });

        if (recentReminder) {
          continue; // Skip - already sent reminder within frequency window
        }

        // Prepare client name
        const clientName = client.name ||
          (client.firstName && client.lastName ? `${client.firstName} ${client.lastName}` : null);

        const hasIncompleteIntake = client.intakeInterviews?.[0]?.status === 'IN_PROGRESS';
        const emailContext = await resolveClientEmailContext({
          userId: client.id,
          advisorProfileId: advisor.id,
        });
        const assessmentUrl = clientPortalUrl(
          emailContext,
          hasIncompleteIntake ? "/intake" : "/assessment",
        );

        const clientEmail = decryptUserEmail(client.emailCiphertext);

        const result = await sendClientSystemEmail(
          clientEmail,
          buildAssessmentReminderClientEmail(
            emailContext,
            clientName,
            assessmentUrl,
          ),
          emailContext,
        );

        if (result.sent) {
          clientsReminded++;
          console.log(`Sent assessment reminder to ${clientEmail}`);
        } else {
          console.error(
            `Failed to send assessment reminder to ${clientEmail}:`,
            "reason" in result ? result.reason : "unknown",
          );
        }

      } catch (clientError) {
        console.error(`Error processing assessment reminder for client ${assignment.clientId}:`, clientError);
        // Continue processing other clients
      }
    }

    console.log(`Assessment reminders processed: ${clientsReminded} clients reminded`);

    return {
      clientsReminded,
    };
  } catch (error) {
    console.error("Error processing assessment reminders:", error);
    throw error;
  }
}
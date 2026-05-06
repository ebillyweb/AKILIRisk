import "server-only";

import { prisma } from "@/lib/db";
import { computeClientStage, isStalled, getStageLabel } from "@/lib/pipeline/status";
import { shouldSendNotification } from "@/lib/notifications/preferences";
import { sendNotification } from "@/lib/notifications/service";
import { renderNotificationEmail } from "@/lib/notifications/templates";
import { decryptUserEmail } from "@/lib/auth/user-email";
interface ProcessResult {
  advisorsNotified: number;
  clientsEscalated: number;
}

/**
 * Processes workflow reminders for stalled client workflows.
 *
 * Logic:
 * - Uses isStalled() function from status.ts (>7 days inactive)
 * - Finds all ClientAdvisorAssignment records and computes stage
 * - Filters to clients where isStalled(lastActivity, stage) is true AND stage is not COMPLETE
 * - For clients stalled >30 days, escalates with 'stalled' category
 * - Checks shouldSendNotification for advisor before sending
 * - Prevents duplicate notifications within 7 days using AdvisorNotification records
 * - Sends notifications to ADVISORS (not clients)
 *
 * Returns summary of processing results.
 */
export async function processWorkflowReminders(): Promise<ProcessResult> {
  let advisorsNotified = 0;
  let clientsEscalated = 0;

  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    // Find all client advisor assignments with complete data for stage computation
    const assignments = await prisma.clientAdvisorAssignment.findMany({
      where: {
        status: 'ACTIVE',
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
          },
        },
        advisor: {
          select: {
            id: true,
            firmName: true,
            logoUrl: true,
            user: {
              select: {
                id: true,
                emailCiphertext: true,
                name: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
    });

    for (const assignment of assignments) {
      try {
        const clientId = assignment.clientId;
        const advisorId = assignment.advisorId;
        const advisor = assignment.advisor;

        // Get additional client data for stage computation
        const clientData = await prisma.user.findUnique({
          where: { id: clientId },
          include: {
            intakeInterviews: {
              select: {
                status: true,
                updatedAt: true,
                submittedAt: true,
              },
              orderBy: {
                updatedAt: 'desc',
              },
              take: 1,
            },
            assessments: {
              select: {
                status: true,
                completedAt: true,
                updatedAt: true,
              },
              orderBy: {
                updatedAt: 'desc',
              },
              take: 1,
            },
            documentRequirements: {
              select: {
                id: true,
                fulfilled: true,
              },
            },
          },
        });

        if (!clientData) continue;

        // Get invitation data if exists (separate query since it's not directly linked)
        const invitation = await prisma.inviteCode.findFirst({
          where: {
            status: 'REGISTERED',
            createdBy: assignment.advisorId,
          },
          orderBy: {
            statusUpdatedAt: 'desc',
          },
          select: {
            status: true,
            statusUpdatedAt: true,
          },
        });

        // Prepare data for stage computation
        const latestIntake = clientData.intakeInterviews?.[0];
        const latestAssessment = clientData.assessments?.[0];
        const intakeWaived = assignment.intakeWaivedAt != null;
        const intakeForStage =
          latestIntake != null
            ? {
                status: latestIntake.status,
                updatedAt: latestIntake.updatedAt,
                submittedAt: latestIntake.submittedAt,
                waived: intakeWaived,
              }
            : intakeWaived
              ? {
                  status: "NOT_STARTED" as const,
                  updatedAt: assignment.assignedAt,
                  submittedAt: null as Date | null,
                  waived: true as const,
                }
              : undefined;

        const stageData = {
          invitation: invitation ? {
            status: invitation.status,
            statusUpdatedAt: invitation.statusUpdatedAt,
          } : undefined,
          intake: intakeForStage,
          assessment: latestAssessment ? {
            status: latestAssessment.status,
            completedAt: latestAssessment.completedAt,
            updatedAt: latestAssessment.updatedAt,
          } : undefined,
          documents: {
            required: clientData.documentRequirements.length,
            fulfilled: clientData.documentRequirements.filter(d => d.fulfilled).length,
          },
        };

        // Compute current stage
        const stage = computeClientStage(stageData);

        // Skip if workflow is complete
        if (stage === 'COMPLETE') {
          continue;
        }

        // Determine last activity date based on stage
        let lastActivity: Date;
        if (latestAssessment?.updatedAt) {
          lastActivity = latestAssessment.updatedAt;
        } else if (latestIntake?.updatedAt) {
          lastActivity = latestIntake.updatedAt;
        } else if (invitation?.statusUpdatedAt) {
          lastActivity = invitation.statusUpdatedAt;
        } else {
          lastActivity = assignment.assignedAt;
        }

        // Check if workflow is stalled
        const stalledWorkflow = isStalled(lastActivity, stage);
        if (!stalledWorkflow) {
          continue;
        }

        // Determine if this is an escalation case (>30 days)
        const isEscalation = lastActivity < thirtyDaysAgo;
        const category = isEscalation ? 'stalled' : 'stalled';

        // Check if advisor should receive notifications
        const shouldSend = await shouldSendNotification(advisor.user.id, category, 'email');
        if (!shouldSend) {
          continue;
        }

        // Check for recent stalled notifications for this client to prevent spam
        const recentNotification = await prisma.advisorNotification.findFirst({
          where: {
            advisorId: advisorId,
            type: 'WORKFLOW_STALLED',
            referenceId: clientId,
            createdAt: {
              gte: sevenDaysAgo,
            },
          },
        });

        if (recentNotification) {
          continue; // Skip - already notified about this client within 7 days
        }

        // Prepare client name
        const clientName = assignment.client.name ||
          (assignment.client.firstName && assignment.client.lastName
            ? `${assignment.client.firstName} ${assignment.client.lastName}`
            : 'Client');

        // Prepare advisor name
        const advisorName = advisor.user.name ||
          (advisor.user.firstName && advisor.user.lastName
            ? `${advisor.user.firstName} ${advisor.user.lastName}`
            : 'Advisor');

        // Calculate days stalled
        const daysSinceActivity = Math.floor((Date.now() - lastActivity.getTime()) / (1000 * 60 * 60 * 24));

        // Client detail URL
        const clientDetailUrl = `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/advisor/clients/${clientId}`;

        // Generate email HTML using the stalled workflow template
        const emailHtml = renderNotificationEmail('stalled', {
          clientName,
          days: daysSinceActivity,
          stage: getStageLabel(stage),
          clientDetailUrl,
          advisorName,
          firmName: advisor.firmName || 'Akili Risk',
          logoUrl: advisor.logoUrl || undefined,
        });

        // Round-11 commit 2.4b: decrypt advisor email; emailCiphertext
        // is non-null after the schema flip, so the previous
        // "no email address" branch is unreachable.
        const advisorEmail = decryptUserEmail(advisor.user.emailCiphertext);

        // Send notification
        const result = await sendNotification({
          recipientUserId: advisor.user.id,
          recipientEmail: advisorEmail,
          category: 'stalled',
          title: 'Workflow Stalled',
          message: `${clientName} has been inactive for ${daysSinceActivity} days at the ${getStageLabel(stage)} stage`,
          referenceId: clientId,
          advisorProfileId: advisorId,
          emailSubject: `Workflow Stalled: ${clientName} - Akili Risk`,
          emailHtml,
        });

        if (result.emailSent || result.inAppCreated) {
          advisorsNotified++;
          if (isEscalation) {
            clientsEscalated++;
          }
          console.log(`Notified advisor ${advisorEmail} about stalled workflow for ${clientName} (${daysSinceActivity} days)`);
        } else {
          console.error(`Failed to send stalled workflow notification for client ${clientId}`);
        }

      } catch (clientError) {
        console.error(`Error processing workflow reminder for assignment ${assignment.id}:`, clientError);
        // Continue processing other assignments
      }
    }

    console.log(`Workflow reminders processed: ${advisorsNotified} advisors notified, ${clientsEscalated} clients escalated`);

    return {
      advisorsNotified,
      clientsEscalated,
    };
  } catch (error) {
    console.error("Error processing workflow reminders:", error);
    throw error;
  }
}
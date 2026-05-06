import "server-only";

import { prisma } from "../db";
import { sendNotification } from "./service";
import { decryptUserEmail } from "@/lib/auth/user-email";

/**
 * Triggers advisor notification when a client registers from an invitation
 * Fire-and-forget pattern: notification failure must not block registration
 */
export async function triggerRegistrationNotification(
  clientUserId: string,
  clientName: string,
  clientEmail: string
): Promise<void> {
  try {
    // Look up the advisor linked to this client via ClientAdvisorAssignment
    const assignment = await prisma.clientAdvisorAssignment.findFirst({
      where: {
        clientId: clientUserId,
        status: 'ACTIVE',
      },
      include: {
        advisor: {
          include: {
            user: {
              select: {
                id: true,
                // Round-11 commit 2.4b: ciphertext, decrypt at usage.
                emailCiphertext: true,
              },
            },
          },
        },
      },
    });

    if (!assignment) {
      // If no assignment exists yet, check if this was an advisor-created invitation
      const invitation = await prisma.inviteCode.findFirst({
        where: {
          status: 'REGISTERED',
          // Find recently updated invitation for this client
          // We'll look for invitations updated in the last hour as a reasonable window
        },
        orderBy: {
          statusUpdatedAt: 'desc',
        },
        include: {
          advisor: {
            include: {
              user: {
                select: {
                  id: true,
                  // Round-11 commit 2.4b: ciphertext, decrypt at usage.
                  emailCiphertext: true,
                },
              },
            },
          },
        },
        take: 1,
      });

      if (invitation?.createdBy && invitation.advisor) {
        // Found the advisor who created the invitation
        await sendNotification({
          recipientUserId: invitation.advisor.user.id,
          recipientEmail: decryptUserEmail(invitation.advisor.user.emailCiphertext),
          category: 'registration',
          title: 'New Client Registered',
          message: `${clientName} (${clientEmail}) has registered from your invitation`,
          referenceId: clientUserId,
          advisorProfileId: invitation.advisor.id,
        });
      } else {
        console.warn(`No advisor found for client registration: ${clientUserId}`);
      }
      return;
    }

    // Send notification to the assigned advisor
    await sendNotification({
      recipientUserId: assignment.advisor.user.id,
      recipientEmail: decryptUserEmail(assignment.advisor.user.emailCiphertext),
      category: 'registration',
      title: 'New Client Registered',
      message: `${clientName} (${clientEmail}) has registered from your invitation`,
      referenceId: clientUserId,
      advisorProfileId: assignment.advisor.id,
    });
  } catch (error) {
    // Fire-and-forget: log error but don't throw
    console.error('Failed to trigger registration notification:', error);
  }
}

/**
 * Triggers advisor notification when a client completes a milestone
 * Fire-and-forget pattern: notification failure must not block milestone completion
 */
export async function triggerMilestoneNotification(
  clientUserId: string,
  milestone: string
): Promise<void> {
  try {
    // Look up the advisor linked to this client via ClientAdvisorAssignment
    const assignment = await prisma.clientAdvisorAssignment.findFirst({
      where: {
        clientId: clientUserId,
        status: 'ACTIVE',
      },
      include: {
        advisor: {
          include: {
            user: {
              select: {
                id: true,
                // Round-11 commit 2.4b: ciphertext, decrypt at usage.
                emailCiphertext: true,
              },
            },
          },
        },
      },
    });

    if (!assignment) {
      console.warn(`No advisor assignment found for client milestone: ${clientUserId}`);
      return;
    }

    // Resolve client name from User record
    const client = await prisma.user.findUnique({
      where: { id: clientUserId },
      select: { name: true },
    });

    const clientName = client?.name || 'Client';

    // Send notification to the assigned advisor
    await sendNotification({
      recipientUserId: assignment.advisor.user.id,
      recipientEmail: decryptUserEmail(assignment.advisor.user.emailCiphertext),
      category: 'milestone',
      title: milestone,
      message: `${clientName} has completed ${milestone}`,
      referenceId: clientUserId,
      advisorProfileId: assignment.advisor.id,
    });
  } catch (error) {
    // Fire-and-forget: log error but don't throw
    console.error('Failed to trigger milestone notification:', error);
  }
}

/**
 * Triggers advisor notification when a client uploads a document
 * Fire-and-forget pattern: notification failure must not block document upload
 */
export async function triggerDocumentUploadNotification(
  clientUserId: string,
  documentName: string
): Promise<void> {
  try {
    // Look up the advisor linked to this client via ClientAdvisorAssignment
    const assignment = await prisma.clientAdvisorAssignment.findFirst({
      where: {
        clientId: clientUserId,
        status: 'ACTIVE',
      },
      include: {
        advisor: {
          include: {
            user: {
              select: {
                id: true,
                // Round-11 commit 2.4b: ciphertext, decrypt at usage.
                emailCiphertext: true,
              },
            },
          },
        },
      },
    });

    if (!assignment) {
      console.warn(`No advisor assignment found for document upload: ${clientUserId}`);
      return;
    }

    // Resolve client name from User record
    const client = await prisma.user.findUnique({
      where: { id: clientUserId },
      select: { name: true },
    });

    const clientName = client?.name || 'Client';

    // Send notification to the assigned advisor
    await sendNotification({
      recipientUserId: assignment.advisor.user.id,
      recipientEmail: decryptUserEmail(assignment.advisor.user.emailCiphertext),
      category: 'milestone',
      title: 'Document Uploaded',
      message: `${clientName} uploaded ${documentName}`,
      referenceId: clientUserId,
      advisorProfileId: assignment.advisor.id,
    });
  } catch (error) {
    // Fire-and-forget: log error but don't throw
    console.error('Failed to trigger document upload notification:', error);
  }
}
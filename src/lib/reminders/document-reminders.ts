import "server-only";

import { prisma } from "@/lib/db";
import { sendDocumentReminderEmail } from "./reminder-email";
import { decryptUserEmail } from "@/lib/auth/user-email";
import { getPublicAppUrlStrict } from "@/lib/public-app-url";

interface ProcessResult {
  clientsReminded: number;
  documentsIncluded: number;
}

/**
 * Processes document reminders for clients with unfulfilled document requirements.
 *
 * Logic:
 * - Only reminds about documents created more than 3 days ago (grace period)
 * - Only sends reminders if last reminder was more than 7 days ago (or never sent)
 * - Groups documents by client to send one email per client
 * - Updates lastReminderSentAt after successful email send
 *
 * Returns summary of processing results.
 */
export async function processDocumentReminders(): Promise<ProcessResult> {
  let clientsReminded = 0;
  let documentsIncluded = 0;

  const appUrl = getPublicAppUrlStrict();
  if (!appUrl) {
    console.error(
      "Document reminders skipped: public app URL not configured (AUTH_URL / NEXT_PUBLIC_URL)."
    );
    return { clientsReminded: 0, documentsIncluded: 0 };
  }

  try {
    // Calculate cutoff dates
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000); // 3 days grace period
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 day deduplication

    // Find unfulfilled document requirements that need reminders
    const documentsNeedingReminders = await prisma.documentRequirement.findMany({
      where: {
        fulfilled: false,
        createdAt: {
          lt: threeDaysAgo, // Created more than 3 days ago
        },
        OR: [
          { lastReminderSentAt: null }, // Never sent reminder
          { lastReminderSentAt: { lt: sevenDaysAgo } }, // Last reminder more than 7 days ago
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

    // Group documents by client
    const clientGroups = new Map<string, typeof documentsNeedingReminders>();
    for (const doc of documentsNeedingReminders) {
      const clientId = doc.clientId;
      if (!clientGroups.has(clientId)) {
        clientGroups.set(clientId, []);
      }
      clientGroups.get(clientId)!.push(doc);
    }

    // Process each client group
    for (const [clientId, clientDocs] of clientGroups) {
      try {
        if (clientDocs.length === 0) continue;

        const firstDoc = clientDocs[0];
        const client = firstDoc.client;
        const advisor = firstDoc.advisor;

        // Prepare client name
        const clientName = client.name ||
          (client.firstName && client.lastName ? `${client.firstName} ${client.lastName}` : null);

        // Prepare advisor name
        const advisorName = advisor.user.name ||
          (advisor.user.firstName && advisor.user.lastName
            ? `${advisor.user.firstName} ${advisor.user.lastName}`
            : 'Your Advisor');

        // Prepare firm name
        const advisorFirmName = advisor.firmName || 'Akili Risk';

        // Extract document names
        const missingDocuments = clientDocs.map(doc => doc.name);

        // Portal URL (assuming standard documents path)
        const portalUrl = `${appUrl}/documents`;

        // Round-11 commit 2.4b: decrypt once per client.
        const clientEmail = decryptUserEmail(client.emailCiphertext);

        // Send reminder email
        const emailResult = await sendDocumentReminderEmail({
          clientEmail,
          clientName,
          missingDocuments,
          advisorName,
          advisorFirmName,
          advisorLogoUrl: advisor.logoUrl || undefined,
          portalUrl,
        });

        if (emailResult.sent) {
          // Update lastReminderSentAt for all documents in this group
          const documentIds = clientDocs.map(doc => doc.id);
          await prisma.documentRequirement.updateMany({
            where: {
              id: { in: documentIds },
            },
            data: {
              lastReminderSentAt: new Date(),
            },
          });

          clientsReminded++;
          documentsIncluded += clientDocs.length;

          console.log(`Sent reminder to ${clientEmail} for ${clientDocs.length} documents`);
        } else {
          console.error(`Failed to send reminder to ${clientEmail}: ${emailResult.reason}`);
        }
      } catch (clientError) {
        console.error(`Error processing reminders for client ${clientId}:`, clientError);
        // Continue processing other clients
      }
    }

    console.log(`Document reminders processed: ${clientsReminded} clients reminded, ${documentsIncluded} documents included`);

    return {
      clientsReminded,
      documentsIncluded,
    };
  } catch (error) {
    console.error("Error processing document reminders:", error);
    throw error;
  }
}
import "server-only";

import { Resend } from "resend";
import { prisma } from "../db";
import { NotificationCategory, SendNotificationParams } from "./types";
import { shouldSendNotification } from "./preferences";
import { renderNotificationEmail } from "./templates";
import { NotificationType } from "@prisma/client";

const FROM_EMAIL = process.env.FROM_EMAIL || "onboarding@resend.dev";

/**
 * Maps notification categories to Prisma NotificationType enum values
 */
const CATEGORY_TO_NOTIFICATION_TYPE: Record<NotificationCategory, NotificationType> = {
  'registration': 'CLIENT_REGISTERED',
  'milestone': 'MILESTONE_COMPLETE',
  'stalled': 'WORKFLOW_STALLED',
  'reminder': 'SYSTEM', // Assessment reminders use SYSTEM type
  'system': 'SYSTEM',
};

/**
 * Result of notification sending operation
 */
export interface NotificationResult {
  emailSent: boolean;
  inAppCreated: boolean;
}

/**
 * Checks if an identical notification already exists within the last 24 hours
 * to prevent duplicate in-app notifications
 */
async function isDuplicateNotification(
  advisorId: string,
  type: NotificationType,
  referenceId?: string
): Promise<boolean> {
  if (!referenceId) {
    // Without referenceId, we can't check for duplicates reliably
    return false;
  }

  const twentyFourHoursAgo = new Date();
  twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

  const existing = await prisma.advisorNotification.findFirst({
    where: {
      advisorId,
      type,
      referenceId,
      createdAt: {
        gte: twentyFourHoursAgo,
      },
    },
  });

  return existing !== null;
}

/**
 * Main notification dispatch function
 * Handles preference checking, email sending, and in-app notification creation
 */
export async function sendNotification(params: SendNotificationParams): Promise<NotificationResult> {
  const {
    recipientUserId,
    recipientEmail,
    category,
    title,
    message,
    referenceId,
    advisorProfileId,
    emailSubject,
    emailHtml,
  } = params;

  let emailSent = false;
  let inAppCreated = false;

  // Check email preference and send if allowed
  const shouldSendEmail = await shouldSendNotification(recipientUserId, category, 'email');

  if (shouldSendEmail) {
    try {
      const apiKey = process.env.RESEND_API_KEY;
      if (!apiKey) {
        console.warn("RESEND_API_KEY not configured - notification email will not be sent");
      } else {
        const resend = new Resend(apiKey);

        // Use provided HTML or render from template
        const htmlContent = emailHtml || renderNotificationEmail(category, {
          // Templates will need specific data - this is a simplified approach
          // In practice, the caller should provide the emailHtml for complex templates
          clientName: 'Client', // Placeholder - caller should provide proper template data
          pipelineUrl: process.env.NEXTAUTH_URL || 'http://localhost:3000',
          assessmentUrl: process.env.NEXTAUTH_URL || 'http://localhost:3000',
          clientDetailUrl: process.env.NEXTAUTH_URL || 'http://localhost:3000',
        } as any);

        // Generate subject if not provided
        const subject = emailSubject || `${title} - Akili Risk`;

        const result = await resend.emails.send({
          from: FROM_EMAIL,
          to: recipientEmail,
          subject,
          html: htmlContent,
        });

        if (result.error) {
          console.error("Failed to send notification email:", result.error);
        } else {
          emailSent = true;
        }
      }
    } catch (error) {
      console.error("Error sending notification email:", error);
    }
  }

  // Create in-app notification if advisor profile ID is provided
  if (advisorProfileId) {
    try {
      const notificationType = CATEGORY_TO_NOTIFICATION_TYPE[category];

      // Check for duplicates
      const isDuplicate = await isDuplicateNotification(advisorProfileId, notificationType, referenceId);

      if (!isDuplicate) {
        await prisma.advisorNotification.create({
          data: {
            advisorId: advisorProfileId,
            type: notificationType,
            title,
            message,
            referenceId,
            read: false,
          },
        });

        inAppCreated = true;
      } else {
        console.log(`Skipping duplicate in-app notification for advisor ${advisorProfileId}, type ${notificationType}, ref ${referenceId}`);
      }
    } catch (error) {
      console.error("Error creating in-app notification:", error);
    }
  }

  return { emailSent, inAppCreated };
}

/**
 * Simplified function for creating in-app notifications only
 */
export async function createInAppNotification(
  advisorId: string,
  type: NotificationType,
  title: string,
  message: string,
  referenceId?: string
): Promise<boolean> {
  try {
    // Check for duplicates
    const isDuplicate = await isDuplicateNotification(advisorId, type, referenceId);

    if (isDuplicate) {
      return false;
    }

    await prisma.advisorNotification.create({
      data: {
        advisorId,
        type,
        title,
        message,
        referenceId,
        read: false,
      },
    });

    return true;
  } catch (error) {
    console.error("Error creating in-app notification:", error);
    return false;
  }
}
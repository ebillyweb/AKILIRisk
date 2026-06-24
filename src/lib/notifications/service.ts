import "server-only";

import { Resend } from "resend";
import { prisma } from "../db";
import { NotificationCategory, SendNotificationParams } from "./types";
import { shouldSendNotification } from "./preferences";
import { withPlatformLogoAttachment } from "@/lib/email/platform-email-logo";
import { resolveFromEmail } from "@/lib/email/resolve-from-email";
import { formatEmailSubject } from "@/lib/email/format-email-subject";
import { getPublicAppUrlStrict } from "@/lib/public-app-url";
import { buildNotificationTemplateData, renderNotificationEmail } from "./templates";
import { NotificationType } from "@prisma/client";

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
        const appUrl = getPublicAppUrlStrict();

        // Use provided HTML or render from template
        const htmlContent = emailHtml || (appUrl
          ? renderNotificationEmail(
              category,
              buildNotificationTemplateData(
                category,
                { title, message, referenceId },
                appUrl
              )
            )
          : null);

        if (!htmlContent) {
          console.warn(
            "Notification email skipped: public app URL not configured (AUTH_URL / NEXT_PUBLIC_URL)."
          );
        } else {
          const subject = formatEmailSubject(emailSubject || `${title} - Akili Risk`);

          const result = await resend.emails.send(
            withPlatformLogoAttachment({
              from: resolveFromEmail(),
              to: recipientEmail,
              subject,
              html: htmlContent,
            })
          );

          if (result.error) {
            console.error("Failed to send notification email:", result.error);
          } else {
            emailSent = true;
          }
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
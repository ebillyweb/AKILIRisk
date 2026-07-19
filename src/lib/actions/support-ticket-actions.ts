"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { sendSupportTicketEmail } from "@/lib/email/support-ticket";
import { clientIpFromRequest } from "@/lib/request-ip";
import { rateLimit } from "@/lib/rate-limit";
import {
  SUPPORT_TICKET_CATEGORIES,
  type SupportTicketCategory,
} from "@/lib/support/categories";
import {
  SUPPORT_ATTACHMENT_ALLOWED_TYPES,
  validateSupportTicketAttachment,
} from "@/lib/support/attachment";
import {
  isContactCaptchaBypassEnabled,
  isTurnstileConfigured,
  verifyTurnstileToken,
} from "@/lib/turnstile/verify";

const categoryValues = SUPPORT_TICKET_CATEGORIES.map(
  (category) => category.value
) as [SupportTicketCategory, ...SupportTicketCategory[]];

const supportTicketSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Name is required")
    .max(120, "Name is too long"),
  category: z.enum(categoryValues, { message: "Select a category" }),
  subject: z
    .string()
    .trim()
    .min(1, "Subject is required")
    .max(200, "Subject is too long"),
  message: z
    .string()
    .trim()
    .min(10, "Message must be at least 10 characters")
    .max(5000, "Message is too long"),
  turnstileToken: z.string().optional(),
  attachment: z
    .object({
      filename: z.string().trim().min(1).max(180),
      contentType: z.enum(SUPPORT_ATTACHMENT_ALLOWED_TYPES),
      contentBase64: z.string().min(1).max(6_000_000),
    })
    .optional(),
});

function supportTicketRateLimitKey(userId: string, ip: string | null): string {
  return `support-ticket:${userId}:${ip ?? "unknown"}`;
}

export async function submitSupportTicket(
  input: z.infer<typeof supportTicketSchema>
): Promise<{ success: true } | { success: false; error: string }> {
  const session = await auth();
  if (!session?.user?.id || !session.user.email) {
    return { success: false, error: "Not authenticated" };
  }

  const parsed = supportTicketSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input",
    };
  }

  const headerList = await headers();
  const ip = clientIpFromRequest({ headers: headerList });
  const limit = rateLimit({
    key: supportTicketRateLimitKey(session.user.id, ip),
    limit: 5,
    windowMs: 60 * 60 * 1000,
  });
  if (!limit.success) {
    return {
      success: false,
      error: "Too many submissions. Please try again later.",
    };
  }

  const captchaRequired =
    isTurnstileConfigured() || !isContactCaptchaBypassEnabled();
  if (captchaRequired) {
    const token = parsed.data.turnstileToken?.trim();
    if (!token) {
      return {
        success: false,
        error: "Please complete the security check.",
      };
    }
    const captchaOk = await verifyTurnstileToken(token, ip);
    if (!captchaOk) {
      return {
        success: false,
        error: "Security check failed. Please try again.",
      };
    }
  }

  let attachment:
    | {
        filename: string;
        contentType: (typeof SUPPORT_ATTACHMENT_ALLOWED_TYPES)[number];
        contentBase64: string;
      }
    | undefined;
  if (parsed.data.attachment) {
    const validated = validateSupportTicketAttachment(parsed.data.attachment);
    if (!validated.ok) {
      return { success: false, error: validated.error };
    }
    attachment = {
      filename: validated.filename,
      contentType: validated.contentType,
      contentBase64: validated.contentBase64,
    };
  }

  const { name, category, subject, message } = parsed.data;
  return sendSupportTicketEmail({
    name,
    email: session.user.email,
    category,
    subject,
    message,
    userId: session.user.id,
    userRole: session.user.role?.toString() ?? "UNKNOWN",
    attachment,
  });
}

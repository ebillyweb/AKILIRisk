"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { sendContactFormEmail } from "@/lib/email/contact-form";
import { clientIpFromRequest } from "@/lib/request-ip";
import { rateLimit } from "@/lib/rate-limit";
import {
  isContactCaptchaBypassEnabled,
  isTurnstileConfigured,
  verifyTurnstileToken,
} from "@/lib/turnstile/verify";

const contactFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Name is required")
    .max(120, "Name is too long"),
  email: z
    .string()
    .trim()
    .email("Enter a valid email address")
    .max(254, "Email is too long")
    .transform((s) => s.toLowerCase()),
  subject: z
    .string()
    .trim()
    .max(200, "Subject is too long")
    .transform((s) => s || "General inquiry"),
  message: z
    .string()
    .trim()
    .min(10, "Message must be at least 10 characters")
    .max(5000, "Message is too long"),
  turnstileToken: z.string().optional(),
  audience: z.enum(["general", "sales"]).optional(),
});

function contactFormRateLimitKey(ip: string | null): string {
  return `contact-form:${ip ?? "unknown"}`;
}

export async function submitContactForm(
  input: z.infer<typeof contactFormSchema>
): Promise<{ success: true } | { success: false; error: string }> {
  const parsed = contactFormSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input",
    };
  }

  const headerList = await headers();
  const ip = clientIpFromRequest({ headers: headerList });
  const limit = rateLimit({
    key: contactFormRateLimitKey(ip),
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

  const { name, email, subject, message, audience } = parsed.data;
  return sendContactFormEmail(
    { name, email, subject, message },
    audience ?? "general"
  );
}

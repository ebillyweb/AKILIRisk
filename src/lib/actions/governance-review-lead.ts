"use server";

import { FamilyComplexity, InvestableAssetsRange } from "@prisma/client";
import { headers } from "next/headers";
import { z } from "zod";
import { sendGovernanceReviewLeadAckEmail } from "@/lib/email/governance-review-lead-ack";
import { prisma } from "@/lib/db";
import { clientIpFromRequest } from "@/lib/request-ip";
import { rateLimit } from "@/lib/rate-limit";
import {
  isContactCaptchaBypassEnabled,
  isTurnstileConfigured,
  verifyTurnstileToken,
} from "@/lib/turnstile/verify";

const governanceReviewLeadSchema = z.object({
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
    .transform((value) => value.toLowerCase()),
  familyComplexity: z.nativeEnum(FamilyComplexity, {
    errorMap: () => ({ message: "Please select approximate family complexity." }),
  }),
  investableAssetsRange: z.nativeEnum(InvestableAssetsRange).nullable().optional(),
  promptedInterest: z
    .string()
    .trim()
    .max(2000, "Note is too long")
    .nullable()
    .optional(),
  turnstileToken: z.string().optional(),
});

export type SubmitGovernanceReviewLeadParams = z.infer<typeof governanceReviewLeadSchema>;

function assessmentRequestRateLimitKey(ip: string | null): string {
  return `governance-review-lead:${ip ?? "unknown"}`;
}

export async function submitGovernanceReviewLead(
  params: SubmitGovernanceReviewLeadParams
): Promise<{ success: true } | { success: false; error: string }> {
  const parsed = governanceReviewLeadSchema.safeParse(params);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input",
    };
  }

  const headerList = await headers();
  const ip = clientIpFromRequest({ headers: headerList });
  const limit = rateLimit({
    key: assessmentRequestRateLimitKey(ip),
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

  const { name, email, familyComplexity, investableAssetsRange, promptedInterest } =
    parsed.data;

  try {
    await prisma.governanceReviewLead.create({
      data: {
        name,
        email,
        familyComplexity,
        investableAssetsRange: investableAssetsRange ?? null,
        promptedInterest: promptedInterest?.trim() || null,
      },
    });
  } catch (error) {
    console.error("submitGovernanceReviewLead:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to submit request",
    };
  }

  const emailResult = await sendGovernanceReviewLeadAckEmail({ name, email });
  if (!emailResult.sent) {
    console.error(
      "Assessment request saved but acknowledgment email failed:",
      emailResult.reason
    );
  }

  return { success: true };
}

import "server-only";

import type { BillingCycle, SubscriptionTier } from "@prisma/client";
import { z } from "zod";

import { writeAudit, AUDIT_ACTIONS } from "@/lib/audit/audit-log";
import { sendAdvisorEmailVerificationInvite } from "@/lib/auth/send-advisor-email-verification-invite";
import { validatePasswordForSet } from "@/lib/auth/password-policy";
import { hashPasswordForStorage } from "@/lib/auth/password-update";
import { findUserByEmail, userEmailWriteData } from "@/lib/auth/user-email";
import { TIER_LIMITS } from "@/lib/billing/constants";
import { newAdvisorPaidSignupDeadline } from "@/lib/billing/new-advisor-grace";
import { SELF_SERVE_TIERS, type SelfServeTier } from "@/lib/billing/tier-catalog";
import { prisma } from "@/lib/db";
import { getPasswordPolicy } from "@/lib/platform/password-policy-settings";

const checkoutPlanSchema = z.enum(SELF_SERVE_TIERS);
const checkoutCycleSchema = z.enum(["MONTHLY", "ANNUAL"]);

export const advisorSelfServeSignupSchema = z
  .object({
    email: z
      .string()
      .email("Invalid email")
      .max(255)
      .transform((s) => s.trim().toLowerCase()),
    password: z.string().min(1, "Password is required"),
    confirmPassword: z.string().min(1, "Confirm your password"),
    name: z.string().min(1, "Name is required").max(200),
    firmName: z.string().min(1, "Firm name is required").max(200),
    acceptTerms: z.literal(true, {
      message: "You must accept the terms to continue",
    }),
    checkoutPlan: checkoutPlanSchema.optional(),
    checkoutCycle: checkoutCycleSchema.optional(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export type AdvisorSelfServeSignupInput = z.infer<typeof advisorSelfServeSignupSchema>;

export type RegisterSelfServeAdvisorResult =
  | {
      success: true;
      email: string;
      verificationEmailSent: boolean;
      verifyUrlForDev?: string;
    }
  | { success: false; error: string; fieldErrors?: Record<string, string[]> };

function resolveSignupTier(plan?: SelfServeTier): SubscriptionTier {
  return plan ?? "ESSENTIALS";
}

function resolveSignupBillingCycle(cycle?: BillingCycle): BillingCycle {
  return cycle ?? "MONTHLY";
}

export async function registerSelfServeAdvisor(
  input: unknown
): Promise<RegisterSelfServeAdvisorResult> {
  const parsed = advisorSelfServeSignupSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    const message =
      Object.values(fieldErrors).flat().join("; ") || "Validation failed";
    return { success: false, error: message, fieldErrors };
  }

  const data = parsed.data;
  const existing = await findUserByEmail(data.email, {
    select: { id: true, emailVerified: true, role: true },
  });

  if (existing) {
    if (existing.role === "ADVISOR" && !existing.emailVerified) {
      return resendVerificationForPendingAdvisor({
        email: data.email,
        checkoutPlan: data.checkoutPlan,
        checkoutCycle: data.checkoutCycle,
      });
    }
    return {
      success: false,
      error: "An account with this email already exists. Sign in instead.",
      fieldErrors: { email: ["An account with this email already exists."] },
    };
  }

  const policy = await getPasswordPolicy();
  const passwordPolicy = await validatePasswordForSet(data.password, policy);
  if (!passwordPolicy.ok) {
    return {
      success: false,
      error: passwordPolicy.error,
      fieldErrors: { password: [passwordPolicy.error] },
    };
  }

  const hashedPassword = await hashPasswordForStorage(data.password);
  const createdAt = new Date();
  const paidSignupDeadline = newAdvisorPaidSignupDeadline(createdAt);
  const tier = resolveSignupTier(data.checkoutPlan);
  const billingCycle = resolveSignupBillingCycle(data.checkoutCycle);
  const firm = data.firmName.trim();
  const displayName = data.name.trim();

  const user = await prisma.$transaction(async (tx) => {
    const u = await tx.user.create({
      data: {
        ...userEmailWriteData(data.email),
        password: hashedPassword,
        passwordChangeRequired: false,
        passwordPolicyRevision: policy.revision,
        role: "ADVISOR",
        emailVerified: null,
        name: displayName,
      },
      select: { id: true },
    });

    await tx.advisorProfile.create({
      data: {
        userId: u.id,
        firmName: firm,
        brandName: firm,
      },
    });

    const sub = await tx.subscription.create({
      data: {
        userId: u.id,
        tier,
        status: "UNPAID",
        clientLimit: TIER_LIMITS[tier],
        billingCycle,
        currentPeriodEnd: createdAt,
      },
    });

    await tx.subscriptionAuditLog.create({
      data: {
        subscriptionId: sub.id,
        action: "self_serve_advisor_pending_checkout",
        newTier: tier,
        metadata: {
          paidSignupDeadline: paidSignupDeadline.toISOString(),
          billingCycle,
          source: "self_serve_signup",
        },
      },
    });

    return u;
  });

  await writeAudit({
    actor: { userId: user.id, email: data.email, role: "ADVISOR" },
    action: AUDIT_ACTIONS.AUTH_REGISTER,
    entityType: "User",
    entityId: user.id,
    metadata: {
      role: "ADVISOR",
      source: "self_serve_signup",
      checkoutPlan: data.checkoutPlan ?? null,
      checkoutCycle: data.checkoutCycle ?? null,
    },
  });

  const emailResult = await sendAdvisorEmailVerificationInvite({
    email: data.email,
    displayName,
    checkoutPlan: data.checkoutPlan,
    checkoutCycle: data.checkoutCycle,
    context: "self_serve",
  });

  return {
    success: true,
    email: data.email,
    verificationEmailSent: emailResult.sent,
    verifyUrlForDev: emailResult.verifyUrlForDev,
  };
}

async function resendVerificationForPendingAdvisor(opts: {
  email: string;
  checkoutPlan?: SelfServeTier;
  checkoutCycle?: BillingCycle;
}): Promise<RegisterSelfServeAdvisorResult> {
  const user = await findUserByEmail(opts.email, {
    where: { deletedAt: null, role: "ADVISOR", emailVerified: null },
    select: { id: true, name: true },
  });

  if (!user) {
    return {
      success: false,
      error: "An account with this email already exists. Sign in instead.",
      fieldErrors: { email: ["An account with this email already exists."] },
    };
  }

  const subscription = await prisma.subscription.findUnique({
    where: { userId: user.id },
    select: { tier: true, billingCycle: true },
  });

  const checkoutPlan =
    opts.checkoutPlan ??
    (subscription && SELF_SERVE_TIERS.includes(subscription.tier as SelfServeTier)
      ? (subscription.tier as SelfServeTier)
      : undefined);
  const checkoutCycle = opts.checkoutCycle ?? subscription?.billingCycle;

  const emailResult = await sendAdvisorEmailVerificationInvite({
    email: opts.email,
    displayName: user.name?.trim() || "Advisor",
    checkoutPlan,
    checkoutCycle,
    context: "self_serve",
  });

  return {
    success: true,
    email: opts.email,
    verificationEmailSent: emailResult.sent,
    verifyUrlForDev: emailResult.verifyUrlForDev,
  };
}

export async function resendAdvisorSignupVerificationEmail(
  input: unknown
): Promise<RegisterSelfServeAdvisorResult> {
  const schema = z.object({
    email: z
      .string()
      .email("Invalid email")
      .transform((s) => s.trim().toLowerCase()),
    checkoutPlan: checkoutPlanSchema.optional(),
    checkoutCycle: checkoutCycleSchema.optional(),
  });

  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Invalid email address." };
  }

  return resendVerificationForPendingAdvisor(parsed.data);
}

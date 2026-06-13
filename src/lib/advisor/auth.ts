import "server-only";

import type { SubscriptionStatus } from "@prisma/client";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import {
  subscriptionEntitlesAdvisorPortal,
  subscriptionQualifiesForPortalEnablement,
} from "@/lib/billing/advisor-portal-subscription";
import { isBillingEnabled } from "@/lib/billing/config";
import {
  resolveBillingContext,
  subscriptionForPortalFromContext,
} from "@/lib/enterprise/billing-context";
import { prisma } from "@/lib/db";
import { isAdvisorHubNavRole } from "@/lib/auth-roles";
import { assertMfaVerified } from "@/lib/auth/require-mfa-verified";
import { decryptUserEmail } from "@/lib/auth/user-email";

/** Thrown by `requireAdvisorRole` when an admin has disabled advisor hub/API access. */
export const ADVISOR_PORTAL_DISABLED_MESSAGE =
  "Advisor portal access has been disabled for your account.";

/** Thrown when billing is on and there is no qualifying Stripe-linked subscription. */
export const ADVISOR_SUBSCRIPTION_REQUIRED_MESSAGE =
  "Advisor portal requires an active subscription. Complete checkout in Billing or contact your administrator.";

/** Billing page with a notice banner when hub access is blocked for subscription. */
export const ADVISOR_SUBSCRIPTION_BILLING_HREF =
  "/advisor/billing?notice=subscription_required";

export function isAdvisorSubscriptionRequiredError(error: unknown): boolean {
  return (
    error instanceof Error &&
    error.message === ADVISOR_SUBSCRIPTION_REQUIRED_MESSAGE
  );
}

/** Send lapsed advisors to subscribe instead of showing inline hub errors. */
export function redirectIfAdvisorSubscriptionRequired(error: unknown): void {
  if (isAdvisorSubscriptionRequiredError(error)) {
    redirect(ADVISOR_SUBSCRIPTION_BILLING_HREF);
  }
}

/** Server-action catch helper: redirect on subscription lapse, else return message. */
export function advisorHubActionErrorMessage(
  error: unknown,
  fallback: string,
): string {
  redirectIfAdvisorSubscriptionRequired(error);
  return error instanceof Error ? error.message : fallback;
}

/** Thrown when the advisor account has been deactivated by an administrator. */
export const ADVISOR_ACCOUNT_DEACTIVATED_MESSAGE =
  "Your account has been deactivated. Contact your administrator if you need access restored.";

function advisorHubAccessFromRow(
  portalFlag: boolean,
  subscription: {
    status: SubscriptionStatus;
    currentPeriodEnd: Date;
    cancelAtPeriodEnd: boolean;
    stripeSubscriptionId: string | null;
    createdAt: Date;
  } | null
): boolean {
  if (!portalFlag) return false;
  const billingOn = isBillingEnabled();

  // Local/staging convenience: when billing isn't wired up
  // (`ENABLE_BILLING_FEATURES=false`), let portal-enabled advisors through
  // without a subscription row so seeded fixtures still load the hub.
  // Production never takes this shortcut — flipping billing off there must
  // not silently grant every advisor full access regardless of subscription
  // state. Mirrors `missingSubscriptionFallback()` in
  // `@/lib/subscription/validation`.
  if (!billingOn && process.env.NODE_ENV !== "production") {
    return true;
  }

  return subscriptionQualifiesForPortalEnablement(subscription, billingOn);
}

/** Thrown when an enterprise membership is suspended. */
export const ADVISOR_ENTERPRISE_SUSPENDED_MESSAGE =
  "Your firm access has been suspended. Contact your firm administrator.";

export type AdvisorHubBlockReason = "deactivated" | "disabled" | "subscription" | "suspended";

export async function getAdvisorHubAccessForUserId(userId: string): Promise<{
  allowed: boolean;
  blockReason: AdvisorHubBlockReason | null;
}> {
  const row = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      role: true,
      deletedAt: true,
      advisorPortalAccessEnabled: true,
    },
  });
  if (!row || row.role !== "ADVISOR") {
    return { allowed: true, blockReason: null };
  }
  if (row.deletedAt) {
    return { allowed: false, blockReason: "deactivated" };
  }
  if (row.advisorPortalAccessEnabled === false) {
    return { allowed: false, blockReason: "disabled" };
  }

  const membership = await prisma.enterpriseMembership.findUnique({
    where: { userId },
    select: {
      status: true,
      enterprise: { select: { status: true } },
    },
  });
  if (membership?.status === "SUSPENDED") {
    return { allowed: false, blockReason: "suspended" };
  }
  if (membership?.enterprise.status === "SUSPENDED") {
    return { allowed: false, blockReason: "suspended" };
  }

  const billingCtx = await resolveBillingContext(userId);
  const subscription = billingCtx
    ? subscriptionForPortalFromContext(billingCtx)
    : null;

  if (
    billingCtx?.kind === "enterprise" &&
    subscription &&
    subscriptionEntitlesAdvisorPortal(subscription)
  ) {
    return { allowed: true, blockReason: null };
  }

  if (advisorHubAccessFromRow(row.advisorPortalAccessEnabled, subscription)) {
    return { allowed: true, blockReason: null };
  }
  return { allowed: false, blockReason: "subscription" };
}

/** @deprecated Use getAdvisorHubAccessForUserId for routing; kept for name clarity in older call sites. */
export async function isAdvisorPortalAccessEnabled(userId: string): Promise<boolean> {
  const { allowed } = await getAdvisorHubAccessForUserId(userId);
  return allowed;
}

async function assertAdvisorPortalAccessForAdvisorRole(userId: string): Promise<void> {
  const { allowed, blockReason } = await getAdvisorHubAccessForUserId(userId);
  if (!allowed) {
    throw new Error(
      blockReason === "deactivated"
        ? ADVISOR_ACCOUNT_DEACTIVATED_MESSAGE
        : blockReason === "disabled"
          ? ADVISOR_PORTAL_DISABLED_MESSAGE
          : blockReason === "suspended"
            ? ADVISOR_ENTERPRISE_SUSPENDED_MESSAGE
            : ADVISOR_SUBSCRIPTION_REQUIRED_MESSAGE
    );
  }
}

/**
 * ADVISOR/ADMIN session only — use for billing checkout and `/advisor/billing` so advisors can
 * subscribe before the full hub entitlement gate in `requireAdvisorRole`.
 */
export async function requireAdvisorSession() {
  const session = await auth();

  if (!session?.user?.id) {
    throw new Error("Not authenticated");
  }

  const userRole = session.user.role?.toString().toUpperCase();
  if (!isAdvisorHubNavRole(userRole)) {
    throw new Error("Unauthorized: Advisor access required");
  }

  await assertMfaVerified(session);

  return {
    userId: session.user.id,
    role: userRole ?? "USER",
  };
}

export async function requireAdvisorRole() {
  const session = await auth();

  if (!session?.user?.id) {
    throw new Error("Not authenticated");
  }

  const userRole = session.user.role?.toString().toUpperCase();
  if (!isAdvisorHubNavRole(userRole)) {
    throw new Error("Unauthorized: Advisor access required");
  }

  await assertMfaVerified(session);

  if (userRole === "ADVISOR") {
    await assertAdvisorPortalAccessForAdvisorRole(session.user.id);
  }

  return {
    userId: session.user.id,
    role: userRole,
    // email surfaced for audit-log writes (round-7 P4); existing callers that
    // destructure `{ userId }` or `{ userId, role }` continue to work because
    // the extra property is just ignored.
    email: session.user.email ?? null,
  };
}

/**
 * Discriminator for `requireAdvisorRole()`'s thrown Error objects so route
 * catch handlers can map them to 401 instead of the generic 500. Keeps the
 * fix from being duplicated across every advisor API route — sweep applied
 * in commit "fix(api): sweep remaining auth-throws-as-500 endpoints".
 *
 * Recognized messages (kept in sync with the helpers above):
 *   - "Not authenticated"
 *   - "Unauthorized: ..."           (role / hub access denied)
 *   - ADVISOR_PORTAL_DISABLED_MESSAGE
 *   - ADVISOR_SUBSCRIPTION_REQUIRED_MESSAGE
 *   - ADVISOR_ACCOUNT_DEACTIVATED_MESSAGE
 */
export function isAdvisorAuthError(e: unknown): boolean {
  if (!(e instanceof Error)) return false;
  const m = e.message;
  if (m === "Not authenticated") return true;
  if (m.startsWith("Unauthorized")) return true;
  if (m === ADVISOR_PORTAL_DISABLED_MESSAGE) return true;
  if (m === ADVISOR_SUBSCRIPTION_REQUIRED_MESSAGE) return true;
  if (m === ADVISOR_ACCOUNT_DEACTIVATED_MESSAGE) return true;
  if (m === ADVISOR_ENTERPRISE_SUSPENDED_MESSAGE) return true;
  return false;
}

export async function getAdvisorProfileOrThrow(userId: string) {
  // Round-11 commit 2.4b: emailCiphertext + decrypt at exit so callers
  // (billing, advisor settings page, invitation actions) keep reading
  // `profile.user.email` as plaintext.
  const profile = await prisma.advisorProfile.findUnique({
    where: { userId },
    include: {
      user: {
        select: {
          name: true,
          emailCiphertext: true,
          firstName: true,
          lastName: true,
        },
      },
    },
  });

  if (!profile) {
    throw new Error("Advisor profile not found");
  }

  return {
    ...profile,
    user: {
      ...profile.user,
      email: decryptUserEmail(profile.user.emailCiphertext),
    },
  };
}
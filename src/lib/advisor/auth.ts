import "server-only";

import type { SubscriptionStatus } from "@prisma/client";

import { auth } from "@/lib/auth";
import { subscriptionQualifiesForPortalEnablement } from "@/lib/billing/advisor-portal-subscription";
import { isBillingEnabled } from "@/lib/billing/config";
import { prisma } from "@/lib/db";
import { decryptUserEmail } from "@/lib/auth/user-email";

/** Thrown by `requireAdvisorRole` when an admin has disabled advisor hub/API access. */
export const ADVISOR_PORTAL_DISABLED_MESSAGE =
  "Advisor portal access has been disabled for your account.";

/** Thrown when billing is on and there is no qualifying Stripe-linked subscription. */
export const ADVISOR_SUBSCRIPTION_REQUIRED_MESSAGE =
  "Advisor portal requires an active subscription. Complete checkout in Billing or contact your administrator.";

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

export type AdvisorHubBlockReason = "deactivated" | "disabled" | "subscription";

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
      subscription: {
        select: {
          status: true,
          currentPeriodEnd: true,
          cancelAtPeriodEnd: true,
          stripeSubscriptionId: true,
        },
      },
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
  if (advisorHubAccessFromRow(row.advisorPortalAccessEnabled, row.subscription)) {
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
  if (userRole !== "ADVISOR" && userRole !== "ADMIN") {
    throw new Error("Unauthorized: Advisor access required");
  }

  return {
    userId: session.user.id,
    role: userRole,
  };
}

export async function requireAdvisorRole() {
  const session = await auth();

  if (!session?.user?.id) {
    throw new Error("Not authenticated");
  }

  const userRole = session.user.role?.toString().toUpperCase();
  if (userRole !== "ADVISOR" && userRole !== "ADMIN") {
    throw new Error("Unauthorized: Advisor access required");
  }

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
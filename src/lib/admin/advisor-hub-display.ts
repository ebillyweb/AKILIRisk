import type { SubscriptionStatus } from "@prisma/client";

import {
  subscriptionEntitlesAdvisorPortal,
  subscriptionQualifiesForPortalEnablement,
} from "@/lib/billing/advisor-portal-subscription";

export type AdminAdvisorHubBadgeVariant = "success" | "warning" | "secondary" | "outline";

export type AdminAdvisorHubDisplay = {
  hubAllowed: boolean;
  needsAttention: boolean;
  hubLabel: string;
  hubBadgeVariant: AdminAdvisorHubBadgeVariant;
  hubDetail?: string;
  subscriptionStatusLabel: string;
  subscriptionStatusVariant: AdminAdvisorHubBadgeVariant;
  /** Solo subscription/plan badges hidden for firm enterprise members. */
  showSubscriptionBadges: boolean;
};

type SubscriptionSnapshot = {
  status: SubscriptionStatus;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
  stripeSubscriptionId: string | null;
  createdAt: Date;
};

function parseDate(value: Date | string): Date {
  return typeof value === "string" ? new Date(value) : value;
}

function humanizeStatus(status: SubscriptionStatus): string {
  return status
    .split("_")
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(" ");
}

function subscriptionSnapshot(
  subscription: {
    status: string;
    currentPeriodEnd: Date | string;
    cancelAtPeriodEnd: boolean;
    stripeSubscriptionId?: string | null;
    createdAt?: Date | string;
  } | null,
): SubscriptionSnapshot | null {
  if (!subscription) return null;
  return {
    status: subscription.status as SubscriptionStatus,
    currentPeriodEnd: parseDate(subscription.currentPeriodEnd),
    cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
    stripeSubscriptionId: subscription.stripeSubscriptionId ?? null,
    createdAt: subscription.createdAt
      ? parseDate(subscription.createdAt)
      : new Date(0),
  };
}

function subscriptionStatusPresentation(
  sub: SubscriptionSnapshot | null,
): Pick<AdminAdvisorHubDisplay, "subscriptionStatusLabel" | "subscriptionStatusVariant"> {
  if (!sub) {
    return { subscriptionStatusLabel: "No subscription", subscriptionStatusVariant: "secondary" };
  }

  const entitled = subscriptionEntitlesAdvisorPortal(sub);
  if (sub.status === "GRACE_PERIOD" && !entitled) {
    return { subscriptionStatusLabel: "Grace expired", subscriptionStatusVariant: "warning" };
  }
  if (!entitled) {
    return {
      subscriptionStatusLabel: humanizeStatus(sub.status),
      subscriptionStatusVariant: sub.status === "UNPAID" || sub.status === "PAST_DUE" ? "warning" : "secondary",
    };
  }

  switch (sub.status) {
    case "ACTIVE":
      return { subscriptionStatusLabel: "Active", subscriptionStatusVariant: "success" };
    case "GRACE_PERIOD":
      return { subscriptionStatusLabel: "Grace period", subscriptionStatusVariant: "warning" };
    case "PAST_DUE":
      return { subscriptionStatusLabel: "Past due", subscriptionStatusVariant: "warning" };
    default:
      return {
        subscriptionStatusLabel: humanizeStatus(sub.status),
        subscriptionStatusVariant: "outline",
      };
  }
}

/**
 * Admin list/edit copy for whether an advisor can use the hub right now.
 * Mirrors `getAdvisorHubAccessForUserId` using row data already on the list query.
 */
export function getAdminAdvisorHubDisplay(input: {
  deletedAt: Date | string | null;
  advisorPortalAccessEnabled: boolean;
  billingEnabled: boolean;
  enterpriseId?: string | null;
  enterpriseName?: string | null;
  enterpriseStatus?: string | null;
  enterpriseMembershipStatus?: string | null;
  subscription: {
    status: string;
    currentPeriodEnd: Date | string;
    cancelAtPeriodEnd: boolean;
    stripeSubscriptionId?: string | null;
    createdAt?: Date | string;
  } | null;
}): AdminAdvisorHubDisplay {
  const enterpriseBilling = Boolean(input.enterpriseId?.trim());

  if (enterpriseBilling) {
    const firmSuspended =
      input.enterpriseMembershipStatus === "SUSPENDED" ||
      input.enterpriseStatus === "SUSPENDED";
    const enterpriseDetail = input.enterpriseName?.trim()
      ? `Billing via ${input.enterpriseName.trim()}`
      : "Billing via firm enterprise subscription";

    if (input.deletedAt) {
      return {
        hubAllowed: false,
        needsAttention: true,
        hubLabel: "Enterprise",
        hubBadgeVariant: "secondary",
        hubDetail: "Account is deactivated.",
        subscriptionStatusLabel: "",
        subscriptionStatusVariant: "secondary",
        showSubscriptionBadges: false,
      };
    }

    if (input.advisorPortalAccessEnabled === false) {
      return {
        hubAllowed: false,
        needsAttention: true,
        hubLabel: "Enterprise",
        hubBadgeVariant: "warning",
        hubDetail: "Portal access is disabled for this advisor.",
        subscriptionStatusLabel: "",
        subscriptionStatusVariant: "secondary",
        showSubscriptionBadges: false,
      };
    }

    if (firmSuspended) {
      return {
        hubAllowed: false,
        needsAttention: true,
        hubLabel: "Enterprise",
        hubBadgeVariant: "warning",
        hubDetail: "Firm access is suspended.",
        subscriptionStatusLabel: "",
        subscriptionStatusVariant: "secondary",
        showSubscriptionBadges: false,
      };
    }

    return {
      hubAllowed: true,
      needsAttention: false,
      hubLabel: "Enterprise",
      hubBadgeVariant: "success",
      hubDetail: enterpriseDetail,
      subscriptionStatusLabel: "",
      subscriptionStatusVariant: "outline",
      showSubscriptionBadges: false,
    };
  }

  const sub = subscriptionSnapshot(input.subscription);
  const subscriptionBadge = subscriptionStatusPresentation(sub);

  if (input.deletedAt) {
    return {
      hubAllowed: false,
      needsAttention: true,
      hubLabel: "Deactivated",
      hubBadgeVariant: "secondary",
      hubDetail: "Account is deactivated.",
      showSubscriptionBadges: true,
      ...subscriptionBadge,
    };
  }

  if (input.advisorPortalAccessEnabled === false) {
    return {
      hubAllowed: false,
      needsAttention: true,
      hubLabel: "Portal off",
      hubBadgeVariant: "warning",
      hubDetail: "Portal access is disabled for this advisor.",
      showSubscriptionBadges: true,
      ...subscriptionBadge,
    };
  }

  if (!sub) {
    return {
      hubAllowed: false,
      needsAttention: true,
      hubLabel: "Subscribe required",
      hubBadgeVariant: "warning",
      hubDetail: "No subscription row — advisor hub is blocked until checkout.",
      showSubscriptionBadges: true,
      ...subscriptionBadge,
    };
  }

  const hubAllowed = subscriptionQualifiesForPortalEnablement(sub, input.billingEnabled);

  if (!hubAllowed) {
    const graceExpired =
      sub.status === "GRACE_PERIOD" && !subscriptionEntitlesAdvisorPortal(sub);
    const needsStripe =
      input.billingEnabled &&
      !sub.stripeSubscriptionId?.trim() &&
      subscriptionEntitlesAdvisorPortal(sub);

    return {
      hubAllowed: false,
      needsAttention: true,
      hubLabel: graceExpired ? "Grace expired" : "Subscribe required",
      hubBadgeVariant: "warning",
      hubDetail: graceExpired
        ? `Grace ended ${sub.currentPeriodEnd.toLocaleDateString()}. Advisor must complete checkout.`
        : needsStripe
          ? "Paid Stripe subscription required to restore hub access."
          : "Subscription does not qualify for advisor hub access.",
      showSubscriptionBadges: true,
      ...subscriptionBadge,
    };
  }

  if (sub.status === "GRACE_PERIOD") {
    return {
      hubAllowed: true,
      needsAttention: false,
      hubLabel: "Grace access",
      hubBadgeVariant: "warning",
      hubDetail: `Grace ends ${sub.currentPeriodEnd.toLocaleDateString()}.`,
      showSubscriptionBadges: true,
      ...subscriptionBadge,
    };
  }

  if (sub.status === "PAST_DUE") {
    return {
      hubAllowed: true,
      needsAttention: false,
      hubLabel: "Hub active",
      hubBadgeVariant: "warning",
      hubDetail: "Subscription is past due — advisor still has hub access during dunning.",
      showSubscriptionBadges: true,
      ...subscriptionBadge,
    };
  }

  return {
    hubAllowed: true,
    needsAttention: false,
    hubLabel: "Hub active",
    hubBadgeVariant: "success",
    showSubscriptionBadges: true,
    ...subscriptionBadge,
  };
}

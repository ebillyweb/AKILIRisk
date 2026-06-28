import type { BillingCycle, SubscriptionTier } from "@prisma/client";

import { clientsOverTierCapacity } from "@/lib/billing/client-limit";
import { TIER_LIMITS } from "@/lib/billing/constants";
import {
  TIER_CATALOG,
  TIER_DISPLAY_NAME,
  TIER_RANK,
  type SelfServeTier,
} from "@/lib/billing/tier-catalog";
import {
  ADVISOR_TIER_FEATURES,
  TIER_FEATURE_COPY,
  tierIncludesFeature,
  type AdvisorTierFeatureKey,
} from "@/lib/billing/tier-features";

export type PlanChangeKind =
  | "subscribe"
  | "resubscribe"
  | "upgrade"
  | "downgrade"
  | "billing_switch";

export type PlanChangeExplainer = {
  kind: PlanChangeKind;
  title: string;
  summary: string;
  bullets: string[];
  warning?: string;
  confirmLabel: string;
};

export type BuildPlanChangeExplainerInput = {
  targetTier: SelfServeTier;
  targetBillingCycle: BillingCycle;
  committedPlan: { tier: SubscriptionTier; billingCycle: BillingCycle } | null;
  changePlanMode: "checkout" | "stripe_update";
  subscriptionStatus: string;
  currentClientCount: number;
};

function billingCycleLabel(cycle: BillingCycle): string {
  return cycle === "ANNUAL" ? "annual" : "monthly";
}

function featureTitlesLost(
  fromTier: SubscriptionTier,
  toTier: SubscriptionTier,
): string[] {
  return (Object.keys(ADVISOR_TIER_FEATURES) as AdvisorTierFeatureKey[])
    .filter(
      (feature) =>
        tierIncludesFeature(fromTier, feature) &&
        !tierIncludesFeature(toTier, feature),
    )
    .map((feature) => TIER_FEATURE_COPY[feature].title);
}

function featureTitlesGained(
  fromTier: SubscriptionTier,
  toTier: SubscriptionTier,
): string[] {
  return (Object.keys(ADVISOR_TIER_FEATURES) as AdvisorTierFeatureKey[])
    .filter(
      (feature) =>
        !tierIncludesFeature(fromTier, feature) &&
        tierIncludesFeature(toTier, feature),
    )
    .map((feature) => TIER_FEATURE_COPY[feature].title);
}

function clientLimitBullet(
  fromTier: SubscriptionTier | null,
  toTier: SelfServeTier,
): string | null {
  const nextLimit = TIER_LIMITS[toTier];
  if (fromTier == null) {
    return `Supports up to ${nextLimit} active clients on your pipeline.`;
  }
  const currentLimit = TIER_LIMITS[fromTier];
  if (currentLimit === nextLimit) return null;
  return `Active client limit changes from ${currentLimit} to ${nextLimit}.`;
}

function catalogHighlights(tier: SelfServeTier, max = 2): string[] {
  return TIER_CATALOG[tier].cardIncludes
    .filter((line) => !/^Everything in /i.test(line))
    .slice(0, max);
}

export function resolvePlanChangeKind(
  input: BuildPlanChangeExplainerInput,
): PlanChangeKind {
  const { targetTier, targetBillingCycle, committedPlan, changePlanMode, subscriptionStatus } =
    input;

  if (subscriptionStatus === "CANCELLED") {
    return "resubscribe";
  }

  if (!committedPlan || changePlanMode === "checkout") {
    return "subscribe";
  }

  if (targetTier === committedPlan.tier) {
    return "billing_switch";
  }

  return TIER_RANK[targetTier] > TIER_RANK[committedPlan.tier]
    ? "upgrade"
    : "downgrade";
}

export function buildPlanChangeExplainer(
  input: BuildPlanChangeExplainerInput,
): PlanChangeExplainer {
  const {
    targetTier,
    targetBillingCycle,
    committedPlan,
    changePlanMode,
    currentClientCount,
  } = input;

  const targetName = TIER_DISPLAY_NAME[targetTier];
  const kind = resolvePlanChangeKind(input);
  const fromTier = committedPlan?.tier ?? null;
  const highlights = catalogHighlights(targetTier);
  const limitBullet = clientLimitBullet(fromTier, targetTier);

  if (kind === "subscribe" || kind === "resubscribe") {
    const bullets = [
      limitBullet,
      ...highlights,
      "You'll complete payment on Stripe Checkout — no charge until you confirm there.",
    ].filter(Boolean) as string[];

    return {
      kind,
      title:
        kind === "resubscribe"
          ? `Resubscribe to ${targetName}?`
          : `Subscribe to ${targetName}?`,
      summary:
        kind === "resubscribe"
          ? "Restart your subscription on the selected plan and billing interval."
          : "Start a new subscription on the selected plan and billing interval.",
      bullets,
      confirmLabel: "Continue to checkout",
    };
  }

  if (kind === "billing_switch") {
    const interval = billingCycleLabel(targetBillingCycle);
    const previous = billingCycleLabel(committedPlan!.billingCycle);

    return {
      kind,
      title: `Switch to ${interval} billing?`,
      summary: `Stay on ${targetName} and change billing from ${previous} to ${interval}.`,
      bullets: [
        "Stripe prorates the difference for the rest of this billing period.",
        "Your plan features and client limit stay the same.",
        `Future renewals bill on a ${interval} cadence.`,
      ],
      confirmLabel: "Confirm billing change",
    };
  }

  if (kind === "upgrade") {
    const gained = featureTitlesGained(fromTier!, targetTier);
    const bullets = [
      "Stripe prorates your subscription — you'll be charged the difference for the rest of this period.",
      "New features unlock immediately after the change processes.",
      limitBullet,
      gained.length > 0
        ? `Unlocks: ${gained.slice(0, 4).join(", ")}.`
        : null,
      ...highlights,
    ].filter(Boolean) as string[];

    return {
      kind,
      title: `Upgrade to ${targetName}?`,
      summary: `Move from ${TIER_DISPLAY_NAME[fromTier!]} to ${targetName} (${billingCycleLabel(targetBillingCycle)} billing).`,
      bullets,
      confirmLabel: "Confirm upgrade",
    };
  }

  const lost = featureTitlesLost(fromTier!, targetTier);
  const clientsOver = clientsOverTierCapacity(currentClientCount, targetTier);

  const bullets = [
    "Stripe adjusts your subscription — unused time on your current plan may become account credit.",
    limitBullet,
    lost.length > 0
      ? `You'll lose access to: ${lost.slice(0, 4).join(", ")}.`
      : "Some higher-tier capabilities will no longer be available.",
  ].filter(Boolean) as string[];

  return {
    kind: "downgrade",
    title: `Downgrade to ${targetName}?`,
    summary: `Move from ${TIER_DISPLAY_NAME[fromTier!]} to ${targetName} (${billingCycleLabel(targetBillingCycle)} billing).`,
    bullets,
    warning:
      clientsOver > 0
        ? `You have ${currentClientCount} active clients but ${targetName} allows ${TIER_LIMITS[targetTier]}. End ${clientsOver} workflow${clientsOver === 1 ? "" : "s"} in Pipeline before downgrading.`
        : undefined,
    confirmLabel: "Confirm downgrade",
  };
}

export function shouldConfirmPlanChange(
  input: BuildPlanChangeExplainerInput,
): boolean {
  const { committedPlan, changePlanMode, subscriptionStatus } = input;

  if (changePlanMode === "checkout") {
    return subscriptionStatus === "NONE" || subscriptionStatus === "CANCELLED";
  }

  if (!committedPlan) return false;

  const samePlan =
    input.targetTier === committedPlan.tier &&
    input.targetBillingCycle === committedPlan.billingCycle;

  return !samePlan;
}

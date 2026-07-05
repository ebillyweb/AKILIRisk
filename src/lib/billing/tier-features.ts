import type { BillingCycle, SubscriptionTier } from "@prisma/client";

import {
  advisorBillingDeepLink,
  SELF_SERVE_TIERS,
  TIER_DISPLAY_NAME,
  TIER_RANK,
  type SelfServeTier,
} from "@/lib/billing/tier-catalog";

/** Advisor workspace capabilities unlocked at each module tier. */
export const ADVISOR_TIER_FEATURES = {
  METHODOLOGY_CUSTOMIZATION: "PROFESSIONAL",
  ADVANCED_BRANDING: "PROFESSIONAL",
  CUSTOM_SUBDOMAIN: "PROFESSIONAL",
  IMPLEMENTATION_ENGAGEMENTS: "BUSINESS",
  PORTFOLIO_ANALYTICS: "PLATINUM",
  RISK_INTELLIGENCE: "PLATINUM",
  CONTINUOUS_MONITORING: "PLATINUM",
  REASSESSMENT_WORKFLOW: "PLATINUM",
} as const satisfies Record<string, SelfServeTier>;

export type AdvisorTierFeatureKey = keyof typeof ADVISOR_TIER_FEATURES;

export const TIER_FEATURE_COPY: Record<
  AdvisorTierFeatureKey,
  { title: string; description: string }
> = {
  METHODOLOGY_CUSTOMIZATION: {
    title: "Methodology customization",
    description:
      "Customize risk domains, intake question banks, assessment questions, narratives, and recommendation rules for your practice.",
  },
  ADVANCED_BRANDING: {
    title: "Advanced branding",
    description:
      "Customize brand colors and extended branding fields on client portals, emails, and PDFs.",
  },
  CUSTOM_SUBDOMAIN: {
    title: "Custom subdomain",
    description: "Claim a branded subdomain for your client portal and invitation links.",
  },
  IMPLEMENTATION_ENGAGEMENTS: {
    title: "Implementation tracking",
    description:
      "Track implementation stages, milestone checkpoints, and engagement progress across your client book.",
  },
  PORTFOLIO_ANALYTICS: {
    title: "Portfolio risk analytics",
    description:
      "Portfolio-level governance dashboard with risk metrics and family-level visibility across your book.",
  },
  RISK_INTELLIGENCE: {
    title: "Risk intelligence",
    description:
      "Unified portfolio intelligence with heat maps, risk domain shortcuts, and family-level risk drill-down.",
  },
  CONTINUOUS_MONITORING: {
    title: "Continuous monitoring",
    description:
      "Ongoing signal monitoring and alerts across families between formal reassessments.",
  },
  REASSESSMENT_WORKFLOW: {
    title: "Reassessment workflow",
    description:
      "Scheduled reassessments, trend comparison, and a dedicated queue for clients due for rescoring.",
  },
};

export function minimumTierForFeature(feature: AdvisorTierFeatureKey): SelfServeTier {
  return ADVISOR_TIER_FEATURES[feature];
}

export function tierIncludesFeature(
  currentTier: SubscriptionTier,
  feature: AdvisorTierFeatureKey
): boolean {
  const required = ADVISOR_TIER_FEATURES[feature];
  return TIER_RANK[currentTier] >= TIER_RANK[required];
}

export function nextSelfServeTier(current: SubscriptionTier): SelfServeTier | null {
  const idx = SELF_SERVE_TIERS.indexOf(current as SelfServeTier);
  if (idx < 0) return SELF_SERVE_TIERS[0];
  if (idx >= SELF_SERVE_TIERS.length - 1) return null;
  return SELF_SERVE_TIERS[idx + 1];
}

export function tierUpgradeMessage(
  feature: AdvisorTierFeatureKey,
  currentTier: SubscriptionTier
): string {
  const required = minimumTierForFeature(feature);
  const requiredName = TIER_DISPLAY_NAME[required];
  const currentName = TIER_DISPLAY_NAME[currentTier] ?? currentTier;
  if (tierIncludesFeature(currentTier, feature)) {
    return `${TIER_FEATURE_COPY[feature].title} is included on your ${currentName} plan.`;
  }
  return `${TIER_FEATURE_COPY[feature].title} requires ${requiredName} or higher. You are on ${currentName}.`;
}

export function advisorTierFeatureBillingHref(
  feature: AdvisorTierFeatureKey,
  billingCycle: BillingCycle = "MONTHLY"
): string {
  return advisorBillingDeepLink(minimumTierForFeature(feature), billingCycle);
}

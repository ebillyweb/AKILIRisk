import type { SubscriptionTier } from "@prisma/client";

import {
  minimumTierForFeature,
  tierIncludesFeature,
  type AdvisorTierFeatureKey,
} from "@/lib/billing/tier-features";
import { TIER_DISPLAY_NAME } from "@/lib/billing/tier-catalog";
import type { AdvisorPlatformFeatureFlags } from "@/lib/platform/feature-flags";

import type { EnterpriseAdvisorMemberVisibilityKey } from "./advisor-member-visibility";

/** Module tier required to offer a visibility toggle; null = always configurable. */
export const ENTERPRISE_MEMBER_VISIBILITY_TIER_FEATURE: Record<
  EnterpriseAdvisorMemberVisibilityKey,
  AdvisorTierFeatureKey | null
> = {
  portfolio: null,
  assessmentLeads: null,
  methodology: "METHODOLOGY_CUSTOMIZATION",
  engagements: "IMPLEMENTATION_ENGAGEMENTS",
  reassessment: "REASSESSMENT_WORKFLOW",
  productTours: null,
  hideTierLockedNav: null,
  skipIntake: null,
};

export type VisibilityOptionTierState = {
  available: boolean;
  requiredTierLabel: string | null;
  includedSummary: string;
};

export function isVisibilityOptionAtModuleTier(
  key: EnterpriseAdvisorMemberVisibilityKey,
  moduleTier: SubscriptionTier,
): boolean {
  const feature = ENTERPRISE_MEMBER_VISIBILITY_TIER_FEATURE[key];
  if (!feature) return true;
  return tierIncludesFeature(moduleTier, feature);
}

export function describePortfolioAtTier(
  moduleTier: SubscriptionTier,
  flags: AdvisorPlatformFeatureFlags,
): string {
  if (!flags.riskIntelligenceEnabled && !flags.governanceDashboardEnabled) {
    return "Portfolio modules are disabled platform-wide.";
  }

  const parts: string[] = [];
  if (flags.riskIntelligenceEnabled) {
    parts.push("reports", "recommendations");
    if (tierIncludesFeature(moduleTier, "RISK_INTELLIGENCE")) {
      parts.push("risk intelligence");
    }
    if (tierIncludesFeature(moduleTier, "CONTINUOUS_MONITORING")) {
      parts.push("signals");
    }
  }
  if (
    flags.governanceDashboardEnabled &&
    tierIncludesFeature(moduleTier, "PORTFOLIO_ANALYTICS")
  ) {
    parts.push("risk analytics");
  }

  if (parts.length === 0) {
    return "No portfolio modules on your current plan.";
  }

  return `On your plan: ${parts.join(", ")}.`;
}

export function getVisibilityOptionTierState(
  key: EnterpriseAdvisorMemberVisibilityKey,
  moduleTier: SubscriptionTier,
  flags: AdvisorPlatformFeatureFlags,
): VisibilityOptionTierState {
  const feature = ENTERPRISE_MEMBER_VISIBILITY_TIER_FEATURE[key];
  const tierName = TIER_DISPLAY_NAME[moduleTier as keyof typeof TIER_DISPLAY_NAME] ?? moduleTier;

  if (key === "portfolio") {
    const includedSummary = describePortfolioAtTier(moduleTier, flags);
    const unavailableOnPlan =
      includedSummary.startsWith("No portfolio modules") ||
      includedSummary.includes("disabled platform-wide");
    return {
      available: !unavailableOnPlan,
      requiredTierLabel: unavailableOnPlan ? "Not included" : null,
      includedSummary,
    };
  }

  if (key === "productTours" || key === "hideTierLockedNav" || key === "skipIntake" || key === "assessmentLeads") {
    return {
      available: true,
      requiredTierLabel: null,
      includedSummary:
        key === "hideTierLockedNav"
          ? "Applies to sidebar links for features above your firm's module tier."
          : key === "skipIntake"
            ? "Team members can skip intake on invites and in the client pipeline."
            : key === "assessmentLeads"
              ? "Team members can view and follow up on AKILI-assigned assessment leads."
              : "Included on all module tiers.",
    };
  }

  if (!feature) {
    return {
      available: true,
      requiredTierLabel: null,
      includedSummary: `Included on your ${tierName} plan.`,
    };
  }

  const available = tierIncludesFeature(moduleTier, feature);
  const required = minimumTierForFeature(feature);
  const requiredLabel = TIER_DISPLAY_NAME[required];

  return {
    available,
    requiredTierLabel: available ? null : requiredLabel,
    includedSummary: available
      ? `Included on your ${tierName} plan.`
      : `Requires ${requiredLabel} or higher (your firm is on ${tierName}).`,
  };
}

export function clampVisibilityToModuleTier(
  visibility: Record<EnterpriseAdvisorMemberVisibilityKey, boolean>,
  moduleTier: SubscriptionTier,
): Record<EnterpriseAdvisorMemberVisibilityKey, boolean> {
  return {
    portfolio: visibility.portfolio,
    assessmentLeads: visibility.assessmentLeads,
    methodology:
      visibility.methodology &&
      isVisibilityOptionAtModuleTier("methodology", moduleTier),
    engagements:
      visibility.engagements &&
      isVisibilityOptionAtModuleTier("engagements", moduleTier),
    reassessment:
      visibility.reassessment &&
      isVisibilityOptionAtModuleTier("reassessment", moduleTier),
    productTours: visibility.productTours,
    hideTierLockedNav: visibility.hideTierLockedNav,
    skipIntake: visibility.skipIntake,
  };
}

import type { SubscriptionTier } from "@prisma/client";

import {
  minimumTierForFeature,
  tierIncludesFeature,
  type AdvisorTierFeatureKey,
} from "@/lib/billing/tier-features";
import { TIER_DISPLAY_NAME, type SelfServeTier } from "@/lib/billing/tier-catalog";
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
  skipPostIntakeReview: null,
  documentRequirements: null,
  actionPlan: null,
  sharedClientVisibility: null,
};

export type VisibilityOptionTierState = {
  available: boolean;
  /** Full lock badge text when unavailable for non-tier reasons (e.g. platform disabled). */
  lockBadge: string | null;
  requiredTierLabel: string | null;
  includedSummary: string;
};

export function formatVisibilityLockBadge(
  state: Pick<VisibilityOptionTierState, "lockBadge" | "requiredTierLabel">,
): string {
  if (state.lockBadge) return state.lockBadge;
  if (state.requiredTierLabel) return `Requires ${state.requiredTierLabel}`;
  return "Unavailable";
}

/** Lowest module tier that unlocks at least one portfolio module for team visibility. */
export function minimumTierForPortfolioConfiguration(
  flags: AdvisorPlatformFeatureFlags,
): SelfServeTier | null {
  if (!flags.riskIntelligenceEnabled && !flags.governanceDashboardEnabled) {
    return null;
  }
  if (flags.riskIntelligenceEnabled) {
    return "ESSENTIALS";
  }
  return minimumTierForFeature("PORTFOLIO_ANALYTICS");
}

function portfolioVisibilityTierState(
  moduleTier: SubscriptionTier,
  flags: AdvisorPlatformFeatureFlags,
): VisibilityOptionTierState {
  const tierName = TIER_DISPLAY_NAME[moduleTier as keyof typeof TIER_DISPLAY_NAME] ?? moduleTier;
  const includedSummary = describePortfolioAtTier(moduleTier, flags);

  if (includedSummary.includes("disabled platform-wide")) {
    return {
      available: false,
      lockBadge: "Unavailable",
      requiredTierLabel: null,
      includedSummary:
        "Portfolio is not enabled for this deployment. Contact AKILI support if you need it for your firm.",
    };
  }

  if (!includedSummary.startsWith("No portfolio modules")) {
    return {
      available: true,
      lockBadge: null,
      requiredTierLabel: null,
      includedSummary,
    };
  }

  const requiredTier = minimumTierForPortfolioConfiguration(flags);
  const requiredLabel =
    requiredTier === null
      ? null
      : TIER_DISPLAY_NAME[requiredTier as keyof typeof TIER_DISPLAY_NAME];

  return {
    available: false,
    lockBadge: null,
    requiredTierLabel: requiredLabel,
    includedSummary:
      requiredLabel === null
        ? "Portfolio is not enabled for this deployment. Contact AKILI support if you need it for your firm."
        : `Requires ${requiredLabel} or higher (your firm is on ${tierName}).`,
  };
}

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
    return portfolioVisibilityTierState(moduleTier, flags);
  }

  if (
    key === "productTours" ||
    key === "hideTierLockedNav" ||
    key === "skipIntake" ||
    key === "skipPostIntakeReview" ||
    key === "documentRequirements" ||
    key === "actionPlan" ||
    key === "assessmentLeads" ||
    key === "sharedClientVisibility"
  ) {
    return {
      available: true,
      lockBadge: null,
      requiredTierLabel: null,
      includedSummary:
        key === "hideTierLockedNav"
          ? "Applies to sidebar links for features above your firm's module tier."
          : key === "skipIntake"
            ? "Team members can skip intake on invites and in the client pipeline."
            : key === "skipPostIntakeReview"
              ? "Team members can skip post-intake review in self-service and live sessions and use default pillars."
            : key === "documentRequirements"
              ? "Team members can request and track mandatory client documents."
              : key === "actionPlan"
                ? "Clients see the action plan journey step and portal page when enabled."
              : key === "assessmentLeads"
                ? "Team members can view and follow up on AKILI-assigned assessment leads."
              : key === "sharedClientVisibility"
                ? "Team members see every client in the firm, not only their own assignments."
                : "Included on all module tiers.",
    };
  }

  if (!feature) {
    return {
      available: true,
      lockBadge: null,
      requiredTierLabel: null,
      includedSummary: `Included on your ${tierName} plan.`,
    };
  }

  const available = tierIncludesFeature(moduleTier, feature);
  const required = minimumTierForFeature(feature);
  const requiredLabel = TIER_DISPLAY_NAME[required];

  return {
    available,
    lockBadge: null,
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
    skipPostIntakeReview: visibility.skipPostIntakeReview,
    documentRequirements: visibility.documentRequirements,
    actionPlan: visibility.actionPlan,
    sharedClientVisibility: visibility.sharedClientVisibility,
  };
}

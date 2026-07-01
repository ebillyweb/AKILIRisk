import type { SubscriptionTier } from "@prisma/client";

import {
  minimumTierForFeature,
  tierIncludesFeature,
} from "@/lib/billing/tier-features";
import { TIER_DISPLAY_NAME } from "@/lib/billing/tier-catalog";

export const ENTERPRISE_MEMBER_BRANDING_POLICY_KEYS = [
  "personalBranding",
  "personalSubdomain",
] as const;

export type EnterpriseMemberBrandingPolicyKey =
  (typeof ENTERPRISE_MEMBER_BRANDING_POLICY_KEYS)[number];

export type EnterpriseMemberBrandingPolicy = Record<
  EnterpriseMemberBrandingPolicyKey,
  boolean
>;

export const DEFAULT_ENTERPRISE_MEMBER_BRANDING_POLICY: EnterpriseMemberBrandingPolicy =
  {
    personalBranding: false,
    personalSubdomain: false,
  };

export function mapEnterpriseMemberBrandingPolicy(row: {
  advisorMemberPersonalBrandingEnabled: boolean;
  advisorMemberSubdomainEditable: boolean;
}): EnterpriseMemberBrandingPolicy {
  return {
    personalBranding: row.advisorMemberPersonalBrandingEnabled,
    personalSubdomain: row.advisorMemberSubdomainEditable,
  };
}

export function brandingPolicyInputToEnterpriseUpdate(
  input: EnterpriseMemberBrandingPolicy,
) {
  return {
    advisorMemberPersonalBrandingEnabled: input.personalBranding,
    advisorMemberSubdomainEditable: input.personalSubdomain,
  };
}

export type BrandingPolicyOptionTierState = {
  available: boolean;
  requiredTierLabel: string | null;
  includedSummary: string;
};

export function isBrandingPolicyOptionAtModuleTier(
  key: EnterpriseMemberBrandingPolicyKey,
  moduleTier: SubscriptionTier,
): boolean {
  if (key === "personalBranding") {
    return tierIncludesFeature(moduleTier, "ADVANCED_BRANDING");
  }
  return (
    tierIncludesFeature(moduleTier, "ADVANCED_BRANDING") &&
    tierIncludesFeature(moduleTier, "CUSTOM_SUBDOMAIN")
  );
}

export function getBrandingPolicyOptionTierState(
  key: EnterpriseMemberBrandingPolicyKey,
  moduleTier: SubscriptionTier,
): BrandingPolicyOptionTierState {
  const tierName =
    TIER_DISPLAY_NAME[moduleTier as keyof typeof TIER_DISPLAY_NAME] ?? moduleTier;
  const available = isBrandingPolicyOptionAtModuleTier(key, moduleTier);

  if (key === "personalBranding") {
    const required = minimumTierForFeature("ADVANCED_BRANDING");
    const requiredLabel = TIER_DISPLAY_NAME[required];
    return {
      available,
      requiredTierLabel: available ? null : requiredLabel,
      includedSummary: available
        ? `Included on your ${tierName} plan.`
        : `Requires ${requiredLabel} or higher (your firm is on ${tierName}).`,
    };
  }

  const required = minimumTierForFeature("CUSTOM_SUBDOMAIN");
  const requiredLabel = TIER_DISPLAY_NAME[required];
  return {
    available,
    requiredTierLabel: available ? null : requiredLabel,
    includedSummary: available
      ? "Requires personal branding and a white-label subdomain on your plan."
      : `Requires ${requiredLabel} or higher (your firm is on ${tierName}).`,
  };
}

export function clampBrandingPolicyToModuleTier(
  policy: EnterpriseMemberBrandingPolicy,
  moduleTier: SubscriptionTier,
): EnterpriseMemberBrandingPolicy {
  const personalBranding =
    policy.personalBranding &&
    isBrandingPolicyOptionAtModuleTier("personalBranding", moduleTier);
  const personalSubdomain =
    policy.personalSubdomain &&
    personalBranding &&
    isBrandingPolicyOptionAtModuleTier("personalSubdomain", moduleTier);

  return {
    personalBranding,
    personalSubdomain,
  };
}

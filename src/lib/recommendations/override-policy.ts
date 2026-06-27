/**
 * Recommendation-specific override policy definitions.
 *
 * Maps ServiceRecommendation fields to override tiers per D-11:
 * - PROTECTED: platform insight, evidence, risk rationale -- never suppressed
 * - CONFIGURABLE: implementation details -- can be replaced by enterprise/advisor
 * - ADDITION: supplementary guidance -- always appendable
 *
 * @see D-11 in 22-CONTEXT.md
 */

import type { FieldOverridePolicy, OverrideTier } from "../asset-catalog/types";

// ---------------------------------------------------------------------------
// Policy map
// ---------------------------------------------------------------------------

/**
 * Field-to-tier mapping for recommendation assets.
 *
 * Keys correspond to ServiceRecommendation and ComposedSolution fields.
 */
export const RECOMMENDATION_FIELD_POLICIES: Record<string, OverrideTier> = {
  // PROTECTED: platform insight, evidence, risk rationale
  name: "PROTECTED",
  description: "PROTECTED",
  expectedOutcome: "PROTECTED",
  tags: "PROTECTED",
  category: "PROTECTED",
  icon: "PROTECTED",
  shortDescription: "PROTECTED",

  // CONFIGURABLE: implementation details
  estimatedCost: "CONFIGURABLE",
  timeframe: "CONFIGURABLE",
  provider: "CONFIGURABLE",
  externalUrl: "CONFIGURABLE",
  playbook: "CONFIGURABLE",

  // ADDITION: supplementary guidance
  notes: "ADDITION",
  prerequisites: "ADDITION",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Return the full FieldOverridePolicy[] array for the recommendation asset type.
 * Suitable for passing to `composeAsset()` from the inheritance engine.
 */
export function getRecommendationPolicies(): FieldOverridePolicy[] {
  return Object.entries(RECOMMENDATION_FIELD_POLICIES).map(
    ([field, tier]) => ({ field, tier })
  );
}

/**
 * Validate a set of field names against the recommendation override policy.
 *
 * Returns which fields are allowed (CONFIGURABLE or ADDITION) vs rejected (PROTECTED).
 * Use this before persisting enterprise or advisor overlay mutations.
 */
export function validateOverlayFields(
  fields: string[]
): { allowed: string[]; rejected: string[] } {
  const allowed: string[] = [];
  const rejected: string[] = [];

  for (const field of fields) {
    const tier = RECOMMENDATION_FIELD_POLICIES[field];
    if (tier === "PROTECTED") {
      rejected.push(field);
    } else {
      allowed.push(field);
    }
  }

  return { allowed, rejected };
}

import type { SubscriptionTier } from "@prisma/client";

import { ENTERPRISE_DEFAULT_CLIENT_LIMIT } from "@/lib/enterprise/constants";

/**
 * Per-tier client limit. Single source of truth at write time — populates
 * Subscription.clientLimit on row create/update. Read enforcement uses the
 * row column (denormalized) so a constant change must be paired with a
 * migration that bumps existing rows.
 *
 * Round-9: aligned with BRD §10.1 (25 / 50 / 100). Was 10 / 25 / 75 from
 * STRIPE-SPEC.md's original rollout. See migration
 * `20260504200000_tier_limit_bump_brd_alignment` for the existing-rows update.
 */
export const TIER_LIMITS: Record<SubscriptionTier, number> = {
  ESSENTIALS: 25,
  PROFESSIONAL: 50,
  BUSINESS: 100,
  PLATINUM: 150,
  ENTERPRISE: ENTERPRISE_DEFAULT_CLIENT_LIMIT,
};

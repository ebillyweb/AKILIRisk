import { SELF_SERVE_TIERS, TIER_CATALOG } from "@/lib/billing/tier-catalog";

export type { TierCatalogEntry, SelfServeTier } from "@/lib/billing/tier-catalog";
export { TIER_CATALOG, SELF_SERVE_TIERS };

export const PRICING_TIERS = SELF_SERVE_TIERS.map((tier) => {
  const entry = TIER_CATALOG[tier];
  return {
    id: tier,
    name: entry.name,
    tagline: entry.tagline,
    modules: entry.modules,
    highlights: [...entry.highlights],
    cardIncludes: [...entry.cardIncludes],
    cardExcludes: entry.cardExcludes ? [...entry.cardExcludes] : undefined,
    featured: entry.featured,
    clientLimit: entry.clientLimit,
    subscriptionTier: tier,
  };
});

export const SOLO_ADVISOR_PRICING_POINTS = [
  "Choose any module tier from Essentials through Platinum",
  "Single practitioner seat with client limits scaled to your practice",
  "Self-serve monthly or annual billing, or start with a guided demo",
  "Upgrade modules as your firm grows — no enterprise contract required",
] as const;

export const ENTERPRISE_PRICING_POINTS = [
  "Same module tiers (Essentials through Platinum) with enterprise volume pricing",
  "Shared firm branding applied consistently across every team seat",
  "Multiple professional logins with team roles and centralized billing",
  "Firm-wide methodology defaults, recommendation rules, and client limits",
  "Sales-assisted provisioning — annual agreements, wire, or card on file",
] as const;

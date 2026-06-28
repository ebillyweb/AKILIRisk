import type { BillingCycle, SubscriptionTier } from "@prisma/client";

import { buildSignInHref } from "@/lib/auth/sign-in-routes";

/** Self-serve advisor tiers shown on pricing and billing (Enterprise is sales-assisted). */
export const SELF_SERVE_TIERS = [
  "ESSENTIALS",
  "PROFESSIONAL",
  "BUSINESS",
  "PLATINUM",
] as const satisfies readonly SubscriptionTier[];

export type SelfServeTier = (typeof SELF_SERVE_TIERS)[number];

export type TierCatalogEntry = {
  tier: SelfServeTier;
  name: string;
  tagline: string;
  modules: string;
  clientLimit: number;
  /** Stripe product name (Dashboard / provision script). */
  stripeProductName: string;
  highlights: readonly string[];
  /** Compact positives for plan comparison cards (billing + pricing). */
  cardIncludes: readonly string[];
  /** Key gaps vs higher tiers — omit on Platinum. */
  cardExcludes?: readonly string[];
  /** Marketing emphasis on pricing page. */
  featured?: boolean;
};

export const TIER_CATALOG: Record<SelfServeTier, TierCatalogEntry> = {
  ESSENTIALS: {
    tier: "ESSENTIALS",
    name: "Essentials",
    tagline: "Structured assessment and client deliverables",
    modules: "Assessment + Reports + Client Plan",
    clientLimit: 25,
    stripeProductName: "Essentials",
    highlights: [
      "10-pillar personal risk profile",
      "Branded PDF reports and client summaries",
      "Prioritized client action plan",
      "Advisor pipeline and invitations",
    ],
    cardIncludes: [
      "10-pillar assessments, PDF reports & action plans",
      "Client pipeline, invitations & deliverables",
      "Standard Akili methodology (not customizable)",
    ],
    cardExcludes: [
      "Custom pillars, intake & white-label branding",
      "Implementation tracking & portfolio analytics",
    ],
  },
  PROFESSIONAL: {
    tier: "PROFESSIONAL",
    name: "Professional",
    tagline: "Your methodology, your firm's voice",
    modules: "Advisor customization + Enterprise overlays",
    clientLimit: 50,
    stripeProductName: "Professional",
    featured: true,
    highlights: [
      "Everything in Essentials",
      "Custom pillars, intake, questions, and narratives",
      "Recommendation rules and methodology snapshots",
      "White-label branding and client portal",
    ],
    cardIncludes: [
      "Everything in Essentials",
      "Custom methodology, intake & assessment content",
      "White-label portal, branding & custom subdomain",
    ],
    cardExcludes: [
      "Implementation milestone tracking",
      "Portfolio analytics & continuous monitoring",
    ],
  },
  BUSINESS: {
    tier: "BUSINESS",
    name: "Business",
    tagline: "Accountable implementation progress",
    modules: "Implementation tracking + milestones",
    clientLimit: 100,
    stripeProductName: "Business",
    highlights: [
      "Everything in Professional",
      "Implementation stage tracking",
      "Milestone checkpoints and follow-ups",
      "Engagement visibility across your book",
    ],
    cardIncludes: [
      "Everything in Professional",
      "Implementation stages & milestone checkpoints",
      "Engagement visibility across your book",
    ],
    cardExcludes: [
      "Portfolio analytics, reassessments & monitoring",
    ],
  },
  PLATINUM: {
    tier: "PLATINUM",
    name: "Platinum",
    tagline: "Ongoing governance intelligence",
    modules: "Continuous monitoring + reassessments + analytics",
    clientLimit: 150,
    stripeProductName: "Platinum",
    highlights: [
      "Everything in Business",
      "Scheduled reassessments and trend comparison",
      "Portfolio-level risk analytics",
      "Continuous monitoring across families",
    ],
    cardIncludes: [
      "Everything in Business",
      "Portfolio analytics & risk intelligence dashboard",
      "Reassessments, trends & continuous monitoring",
    ],
  },
};

export const TIER_DISPLAY_NAME: Record<SubscriptionTier, string> = {
  ESSENTIALS: "Essentials",
  PROFESSIONAL: "Professional",
  BUSINESS: "Business",
  PLATINUM: "Platinum",
  ENTERPRISE: "Enterprise",
};

export const TIER_RANK: Record<SubscriptionTier, number> = {
  ESSENTIALS: 0,
  PROFESSIONAL: 1,
  BUSINESS: 2,
  PLATINUM: 3,
  ENTERPRISE: 4,
};

export function tierEnvKey(tier: SelfServeTier, cycle: BillingCycle): string {
  return `STRIPE_PRICE_${tier}_${cycle}`;
}

/** Legacy env names kept for backward compatibility during Stripe migration. */
export const LEGACY_TIER_ENV_ALIASES: Partial<
  Record<SelfServeTier, Partial<Record<BillingCycle, string>>>
> = {
  ESSENTIALS: {
    MONTHLY: "STRIPE_PRICE_STARTER_MONTHLY",
    ANNUAL: "STRIPE_PRICE_STARTER_ANNUAL",
  },
  PROFESSIONAL: {
    MONTHLY: "STRIPE_PRICE_GROWTH_MONTHLY",
    ANNUAL: "STRIPE_PRICE_GROWTH_ANNUAL",
  },
  BUSINESS: {
    MONTHLY: "STRIPE_PRICE_PROFESSIONAL_MONTHLY",
    ANNUAL: "STRIPE_PRICE_PROFESSIONAL_ANNUAL",
  },
};

export function enterprisePricingDeepLink(
  tier: SelfServeTier,
  billingCycle: BillingCycle
): string {
  const params = new URLSearchParams({
    checkout_plan: tier,
    checkout_cycle: billingCycle,
  });
  return `/advisor/enterprise/pricing?${params.toString()}`;
}

export function advisorBillingDeepLink(
  tier: SelfServeTier,
  billingCycle: BillingCycle
): string {
  const params = new URLSearchParams({
    checkout_plan: tier,
    checkout_cycle: billingCycle,
  });
  return `/advisor/billing?${params.toString()}`;
}

export function pricingSignInHref(
  tier: SelfServeTier,
  billingCycle: BillingCycle
): string {
  return buildSignInHref({
    callbackUrl: advisorBillingDeepLink(tier, billingCycle),
    audience: "staff",
  });
}

export function advisorSignupHref(
  tier: SelfServeTier,
  billingCycle: BillingCycle
): string {
  const params = new URLSearchParams({
    checkout_plan: tier,
    checkout_cycle: billingCycle,
  });
  return `/signup/advisor?${params.toString()}`;
}

export function parseSignupCheckoutIntent(searchParams: {
  checkout_plan?: string | null;
  checkout_cycle?: string | null;
}): { tier: SelfServeTier; billingCycle: BillingCycle } | null {
  const tier =
    searchParams.checkout_plan === "ESSENTIALS" ||
    searchParams.checkout_plan === "PROFESSIONAL" ||
    searchParams.checkout_plan === "BUSINESS" ||
    searchParams.checkout_plan === "PLATINUM"
      ? searchParams.checkout_plan
      : null;
  const billingCycle =
    searchParams.checkout_cycle === "MONTHLY" || searchParams.checkout_cycle === "ANNUAL"
      ? searchParams.checkout_cycle
      : null;
  if (!tier || !billingCycle) return null;
  return { tier, billingCycle };
}

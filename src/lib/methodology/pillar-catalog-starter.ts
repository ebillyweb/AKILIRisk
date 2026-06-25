/**
 * Platform pillar catalog seed definitions (10 pillars).
 * Source of truth until rows exist in the `pillars` table.
 */

export type PlatformPillarStarter = {
  slug: string;
  canonicalName: string;
  description: string;
  defaultOrder: number;
  defaultWeight: number;
};

export const PLATFORM_PILLAR_CATALOG: readonly PlatformPillarStarter[] = [
  {
    slug: "governance",
    canonicalName: "Governance",
    description:
      "Decision rights, family authority, advisor coordination, documentation, and dispute resolution.",
    defaultOrder: 1,
    defaultWeight: 9,
  },
  {
    slug: "cyber-digital",
    canonicalName: "Cyber security",
    description: "Digital footprint, data protection, fraud, and online threats.",
    defaultOrder: 2,
    defaultWeight: 16,
  },
  {
    slug: "physical-security",
    canonicalName: "Physical security",
    description:
      "Personal safety, property security, travel, and physical access control.",
    defaultOrder: 3,
    defaultWeight: 10,
  },
  {
    slug: "insurance",
    canonicalName: "Insurance",
    description:
      "Property, liability, and health continuity coverage; trusts, titling, succession, and concentration risk.",
    defaultOrder: 4,
    defaultWeight: 14,
  },
  {
    slug: "geographic-environmental",
    canonicalName: "Geographic",
    description:
      "Climate and location factors, regional hazards, regulatory context, and geography-driven exposure.",
    defaultOrder: 5,
    defaultWeight: 10,
  },
  {
    slug: "reputational-social",
    canonicalName: "Reputational & social risk",
    description:
      "Public footprint, conduct and social media norms, family standards, and reputation-sensitive behavior.",
    defaultOrder: 6,
    defaultWeight: 8,
  },
  {
    slug: "liquidity-cash",
    canonicalName: "Liquidity & cash management",
    description:
      "Emergency reserves, line-of-credit headroom, illiquid concentration, and short-term obligations.",
    defaultOrder: 7,
    defaultWeight: 12,
  },
  {
    slug: "tax-exposure",
    canonicalName: "Tax exposure",
    description:
      "Residency posture, compensation deferral, AMT/surtax exposure, and estate-tax footprint.",
    defaultOrder: 8,
    defaultWeight: 10,
  },
  {
    slug: "estate-succession",
    canonicalName: "Estate & succession",
    description:
      "Wills and trusts, beneficiary alignment, POA, digital asset access, and business succession readiness.",
    defaultOrder: 9,
    defaultWeight: 6,
  },
  {
    slug: "family-governance-behavioral",
    canonicalName: "Behavioural resilience",
    description:
      "Family dynamics, heir preparedness, emotional resilience, and behavioral-finance pitfalls.",
    defaultOrder: 10,
    defaultWeight: 5,
  },
] as const;

export const PLATFORM_PILLAR_SLUGS = PLATFORM_PILLAR_CATALOG.map((p) => p.slug);

export function pillarStarterBySlug(slug: string): PlatformPillarStarter | undefined {
  return PLATFORM_PILLAR_CATALOG.find((p) => p.slug === slug);
}

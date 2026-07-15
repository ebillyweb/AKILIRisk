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
    canonicalName: "Governance & Decision-Making",
    description:
      "Decision rights, family authority, advisor coordination, documentation, and dispute resolution.",
    defaultOrder: 1,
    defaultWeight: 9,
  },
  {
    slug: "cyber-digital",
    canonicalName: "Cyber & Digital Security",
    description: "Digital footprint, data protection, fraud, and online threats.",
    defaultOrder: 2,
    defaultWeight: 14,
  },
  {
    slug: "physical-security",
    canonicalName: "Physical Security",
    description:
      "Personal safety, property security, travel, and physical access control.",
    defaultOrder: 3,
    defaultWeight: 10,
  },
  {
    slug: "insurance",
    canonicalName: "Protection & Risk Transfer",
    description:
      "Property, liability, and health coverage; risk transfer, titling, concentration, and continuity planning.",
    defaultOrder: 4,
    defaultWeight: 14,
  },
  {
    slug: "geographic-environmental",
    canonicalName: "Geographic & Environmental",
    description:
      "Climate and location factors, regional hazards, environmental exposure, regulatory context, and geography-driven risk.",
    defaultOrder: 5,
    defaultWeight: 10,
  },
  {
    slug: "reputational-social",
    canonicalName: "Reputation & Social Risk",
    description:
      "Public footprint, conduct and social media norms, family standards, and reputation-sensitive behavior.",
    defaultOrder: 6,
    defaultWeight: 7,
  },
  {
    slug: "liquidity-cash",
    canonicalName: "Liquidity & Cash Management",
    description:
      "Emergency reserves, line-of-credit headroom, illiquid concentration, and short-term obligations.",
    defaultOrder: 7,
    defaultWeight: 12,
  },
  {
    slug: "tax-exposure",
    canonicalName: "Tax Exposure",
    description:
      "Residency posture, compensation deferral, AMT/surtax exposure, and estate-tax footprint.",
    defaultOrder: 8,
    defaultWeight: 10,
  },
  {
    slug: "estate-succession",
    canonicalName: "Estate & Succession",
    description:
      "Wills and trusts, beneficiary alignment, POA, digital asset access, and business succession readiness.",
    defaultOrder: 9,
    defaultWeight: 6,
  },
  {
    // Replaced the former Behavioral Resilience pillar. The DB rename of the
    // old slug `family-governance-behavioral` (and category code
    // `10_family_governance`) is handled by migration
    // `20260714120000_rename_family_governance_behavioral_to_ai`.
    slug: "ai-emerging-tech",
    canonicalName: "AI & Emerging Tech Risk",
    description:
      "AI-enabled impersonation and deepfake fraud, synthetic-media reputation attacks, data exposure to AI tools, and governance of AI use across the family and its advisors.",
    defaultOrder: 10,
    defaultWeight: 8,
  },
] as const;

export const PLATFORM_PILLAR_SLUGS = PLATFORM_PILLAR_CATALOG.map((p) => p.slug);

export function pillarStarterBySlug(slug: string): PlatformPillarStarter | undefined {
  return PLATFORM_PILLAR_CATALOG.find((p) => p.slug === slug);
}

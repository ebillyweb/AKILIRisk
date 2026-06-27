import { PLATFORM_PILLAR_CATALOG } from "@/lib/methodology/pillar-catalog-starter";

export const PLATFORM_PILLAR_COUNT = PLATFORM_PILLAR_CATALOG.length;

export type SamplePillarScore = {
  slug: string;
  name: string;
  shortName: string;
  maturity: number;
  inScope: boolean;
  emphasized?: boolean;
};

/** Illustrative maturity scores keyed by platform pillar slug. */
const SAMPLE_MATURITIES: Record<string, { maturity: number; inScope: boolean; emphasized?: boolean }> = {
  governance: { maturity: 2.0, inScope: true },
  "cyber-digital": { maturity: 2.4, inScope: true },
  "physical-security": { maturity: 2.1, inScope: true },
  insurance: { maturity: 2.2, inScope: true },
  "geographic-environmental": { maturity: 0, inScope: false },
  "reputational-social": { maturity: 2.1, inScope: true },
  "liquidity-cash": { maturity: 2.3, inScope: true },
  "tax-exposure": { maturity: 1.9, inScope: true },
  "estate-succession": { maturity: 1.6, inScope: true, emphasized: true },
  "family-governance-behavioral": { maturity: 0, inScope: false },
};

const SHORT_NAMES: Record<string, string> = {
  governance: "Governance",
  "cyber-digital": "Cyber",
  "physical-security": "Physical",
  insurance: "Insurance",
  "geographic-environmental": "Geographic",
  "reputational-social": "Reputation",
  "liquidity-cash": "Liquidity",
  "tax-exposure": "Tax",
  "estate-succession": "Estate",
  "family-governance-behavioral": "Behavioral",
};

export const SAMPLE_HOUSEHOLD = "Chen Family Office";
export const SAMPLE_COMPLETED = "Mar 12, 2026";
export const SAMPLE_QUESTION_COUNT = 142;
export const SAMPLE_MATURITY = 2.2;

export const SAMPLE_PILLAR_SCORES: SamplePillarScore[] = PLATFORM_PILLAR_CATALOG.map(
  (pillar) => {
    const sample = SAMPLE_MATURITIES[pillar.slug] ?? {
      maturity: 2.0,
      inScope: true,
    };
    return {
      slug: pillar.slug,
      name: pillar.canonicalName,
      shortName: SHORT_NAMES[pillar.slug] ?? pillar.canonicalName,
      maturity: sample.maturity,
      inScope: sample.inScope,
      emphasized: sample.emphasized,
    };
  },
);

export const SAMPLE_PILLARS_IN_SCOPE = SAMPLE_PILLAR_SCORES.filter((pillar) => pillar.inScope);

export const SAMPLE_NEXT_STEP =
  "Facilitate a succession planning workshop with the family council — prioritize trigger definitions and authority documentation.";

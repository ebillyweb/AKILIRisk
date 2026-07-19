import type { PillarMidBandNarratives } from "@/lib/assessment/pillar-outcome-expectations-mid-band";
import {
  CYBER_DIGITAL_ALL_NEGATIVE_NARRATIVE_RECOMMENDATIONS,
  CYBER_DIGITAL_ALL_YES_NARRATIVE_RECOMMENDATIONS,
  GEOGRAPHIC_ENVIRONMENTAL_ALL_NEGATIVE_NARRATIVE_RECOMMENDATIONS,
  GEOGRAPHIC_ENVIRONMENTAL_ALL_YES_NARRATIVE_RECOMMENDATIONS,
  GOVERNANCE_ALL_NEGATIVE_NARRATIVE_RECOMMENDATIONS,
  GOVERNANCE_ALL_YES_NARRATIVE_RECOMMENDATIONS,
  INSURANCE_ALL_NEGATIVE_NARRATIVE_RECOMMENDATIONS,
  INSURANCE_ALL_YES_NARRATIVE_RECOMMENDATIONS,
  PHYSICAL_SECURITY_ALL_NEGATIVE_NARRATIVE_RECOMMENDATIONS,
  PHYSICAL_SECURITY_ALL_YES_NARRATIVE_RECOMMENDATIONS,
  REPUTATIONAL_SOCIAL_ALL_NEGATIVE_NARRATIVE_RECOMMENDATIONS,
  REPUTATIONAL_SOCIAL_ALL_YES_NARRATIVE_RECOMMENDATIONS,
  PILLAR_MID_BAND_NARRATIVE_RECOMMENDATIONS,
} from "@/lib/assessment/pillar-outcome-expectations";
import { pillarCatalogSlugs, starterPillarCatalog } from "@/lib/methodology/pillar-catalog";

export type PillarNarrativeBands = {
  allNegative: string[];
  allYes: string[];
  midBand: PillarMidBandNarratives;
};

const ALL_NEGATIVE_BY_SLUG: Partial<Record<string, readonly string[]>> = {
  governance: GOVERNANCE_ALL_NEGATIVE_NARRATIVE_RECOMMENDATIONS,
  "cyber-digital": CYBER_DIGITAL_ALL_NEGATIVE_NARRATIVE_RECOMMENDATIONS,
  "physical-security": PHYSICAL_SECURITY_ALL_NEGATIVE_NARRATIVE_RECOMMENDATIONS,
  insurance: INSURANCE_ALL_NEGATIVE_NARRATIVE_RECOMMENDATIONS,
  "geographic-environmental": GEOGRAPHIC_ENVIRONMENTAL_ALL_NEGATIVE_NARRATIVE_RECOMMENDATIONS,
  "reputational-social": REPUTATIONAL_SOCIAL_ALL_NEGATIVE_NARRATIVE_RECOMMENDATIONS,
};

const ALL_YES_BY_SLUG: Partial<Record<string, readonly string[]>> = {
  governance: GOVERNANCE_ALL_YES_NARRATIVE_RECOMMENDATIONS,
  "cyber-digital": CYBER_DIGITAL_ALL_YES_NARRATIVE_RECOMMENDATIONS,
  "physical-security": PHYSICAL_SECURITY_ALL_YES_NARRATIVE_RECOMMENDATIONS,
  insurance: INSURANCE_ALL_YES_NARRATIVE_RECOMMENDATIONS,
  "geographic-environmental": GEOGRAPHIC_ENVIRONMENTAL_ALL_YES_NARRATIVE_RECOMMENDATIONS,
  "reputational-social": REPUTATIONAL_SOCIAL_ALL_YES_NARRATIVE_RECOMMENDATIONS,
};

const GENERIC_MID_BAND = (topic: string): PillarMidBandNarratives => ({
  critical: [
    `Material gaps remain in ${topic}. Prioritize closing the highest-weight deficiencies identified in this assessment and establish documented practices with advisor coordination.`,
  ],
  high: [
    `Practices related to ${topic} are emerging but inconsistent. Formalize policies, assign accountability, and align advisors around a single remediation plan.`,
  ],
  medium: [
    `Moderate maturity in ${topic} with identifiable strengths and areas needing standardization. Targeted upgrades in the areas flagged below will improve resilience.`,
  ],
  low: [
    `Strong overall posture for ${topic} with only isolated gaps relative to best practice. Address the specific deficiencies noted in this assessment.`,
  ],
});

const NEW_PILLAR_NARRATIVES: Record<string, PillarNarrativeBands> = {
  "liquidity-cash": {
    allNegative: [
      "The household lacks structured liquidity planning, creating exposure when unexpected obligations or market dislocations require rapid cash. We recommend establishing dedicated emergency reserves, stress-testing liquidity against concentrated positions, and maintaining documented line-of-credit capacity.",
    ],
    allYes: [
      "Liquidity and cash management practices are well-developed, with appropriate reserves and access to credit. Periodic stress tests against large obligations and illiquid holdings will keep the framework adaptive.",
    ],
    midBand: GENERIC_MID_BAND("liquidity and cash management"),
  },
  "tax-exposure": {
    allNegative: [
      "Tax exposure is insufficiently mapped across residency, compensation, entity structure, and estate planning, creating risk of unplanned liability. Engage qualified tax counsel for a comprehensive exposure review and coordinated planning with estate and investment advisors.",
    ],
    allYes: [
      "Tax posture is proactively managed with coordinated advisor oversight. Continue annual reviews as residency, compensation, and entity structures evolve.",
    ],
    midBand: GENERIC_MID_BAND("tax exposure"),
  },
  "estate-succession": {
    allNegative: [
      "Estate documents, beneficiary alignment, and succession readiness are materially incomplete, creating ambiguity in authority and transfer intent. Prioritize current wills and trusts, coordinated beneficiary designations, and documented succession protocols.",
    ],
    allYes: [
      "Estate and succession planning reflects strong documentation and alignment across documents and advisors. Periodic review and next-generation preparedness will preserve continuity.",
    ],
    midBand: GENERIC_MID_BAND("estate and succession planning"),
  },
  "ai-emerging-tech": {
    allNegative: [
      "Defenses against AI-enabled threats are underdeveloped, leaving the family exposed to deepfake and voice-clone fraud, synthetic-media reputational attacks, and data leakage into AI tools. Establish out-of-band verification for financial requests, monitoring for synthetic media, and a policy governing use of AI tools.",
    ],
    allYes: [
      "The family shows strong awareness and controls around AI and emerging-tech risk, from impersonation defenses to AI-tool data governance. Maintain the monitoring cadence and update defenses as AI-enabled threats evolve.",
    ],
    midBand: GENERIC_MID_BAND("AI and emerging-tech risk"),
  },
};

export function narrativeStarterForSlug(slug: string): PillarNarrativeBands {
  if (NEW_PILLAR_NARRATIVES[slug]) {
    return NEW_PILLAR_NARRATIVES[slug]!;
  }
  const midBand = PILLAR_MID_BAND_NARRATIVE_RECOMMENDATIONS[slug] ?? GENERIC_MID_BAND(slug);
  return {
    allNegative: [...(ALL_NEGATIVE_BY_SLUG[slug] ?? [])],
    allYes: [...(ALL_YES_BY_SLUG[slug] ?? [])],
    midBand,
  };
}

export function allNarrativeStarterSlugs(): string[] {
  return pillarCatalogSlugs(starterPillarCatalog());
}

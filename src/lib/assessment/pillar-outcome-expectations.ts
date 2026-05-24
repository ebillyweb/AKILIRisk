/**
 * Canonical pillar outcomes when every visible answer is at the lowest maturity.
 * Update when product copy or recommendation rules change.
 */

/** Governance pillar narrative recommendations (all visible answers negative). */
export const GOVERNANCE_ALL_NEGATIVE_NARRATIVE_RECOMMENDATIONS = [
  "Engage an experienced estate planning attorney to establish a comprehensive estate plan to ensure assets are legally structured, titled, and transferred in alignment with the family’s intent. This should include properly drafted wills, trusts, beneficiary designations, and coordinated planning across all entities and jurisdictions.",
  "Establish formal family governance structure to outline who has authority to make decisions, how leadership transitions occur, and how the family governs itself over time. This should include defined governance bodies (i.e. family council, family office, or investment committee), succession protocols, emergency decision authority, and next-generation preparedness.",
] as const;

/** Catalog services for governance-only lowest answers (Belvedere bank). */
export const GOVERNANCE_ALL_NEGATIVE_SERVICE_IDS = [
  "governance_family_charter",
  "governance_advisor_coordination",
  "governance_succession_planning",
  "insurance_estate_planning",
] as const;

/** Per-pillar catalog services triggered when only that pillar’s UI questions are at lowest maturity. */
export const PILLAR_ALL_NEGATIVE_EXPECTED_SERVICE_IDS: Record<string, readonly string[]> = {
  governance: GOVERNANCE_ALL_NEGATIVE_SERVICE_IDS,
  "cyber-digital": ["cyber_security_uplift"],
  "physical-security": [
    "physical_security_assessment",
    "physical_security_implementation",
  ],
  insurance: ["insurance_comprehensive_review", "insurance_asset_protection"],
  "geographic-environmental": [
    "geographic_risk_assessment",
    "geographic_climate_resilience",
    "geographic_diversification",
  ],
  "reputational-social": [
    "social_reputation_management",
    "social_media_governance",
    "social_crisis_response",
  ],
};

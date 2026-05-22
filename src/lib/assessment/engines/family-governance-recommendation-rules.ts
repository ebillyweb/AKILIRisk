/**
 * Recommendation rules keyed to the family-governance UI question bank
 * (`src/lib/assessment/questions.ts` — dma-*, env-*, phys-*, etc.).
 *
 * Seeded alongside legacy import-style rules (`governance_*`, `physical_*`, …)
 * in `scripts/setup-all-pillar-rules.ts`. Services reuse the same catalog IDs.
 */

import type { RecommendationCondition } from "./recommendation-engine";

export type FamilyGovernanceUiRule = {
  id: string;
  serviceRecommendationId: string;
  ruleName: string;
  description?: string;
  triggerConditions: RecommendationCondition[];
  priority: number;
};

/** Optional cyber catalog entry for UI bank gaps (MFA, password manager, etc.). */
export const CYBER_SECURITY_UPLIFT_SERVICE = {
  id: "cyber_security_uplift",
  name: "Cybersecurity Uplift Program",
  description:
    "Household cyber hygiene, MFA, password management, and device hardening for the family office and members",
  category: "security",
  priority: 88,
  estimatedCost: "$10,000 - $35,000",
  timeframe: "2-3 months",
  provider: "Akili Cyber Partners",
  metadata: {
    services: ["MFA rollout", "Password manager", "Device encryption", "Family cyber policy"],
  },
};

/**
 * Rules evaluated when clients complete the Belvedere / family-governance worksheet.
 * Pillar scores use `family-governance` (single PillarScore row in production).
 */
export const FAMILY_GOVERNANCE_UI_RECOMMENDATION_RULES: FamilyGovernanceUiRule[] = [
  {
    id: "fg_ui_governance_charter",
    serviceRecommendationId: "governance_family_charter",
    ruleName: "Family charter (UI — governance structure)",
    description: "No formal governance body or written family standards",
    triggerConditions: [
      { type: "answer_match", questionId: "dma-01", operator: "equals", value: 0, weight: 3 },
      { type: "answer_match", questionId: "bs-01", operator: "in", value: ["none", "informal"], weight: 3 },
      { type: "score_threshold", pillarId: "family-governance", operator: "less_than", value: 1.5, weight: 2 },
    ],
    priority: 96,
  },
  {
    id: "fg_ui_advisor_coordination",
    serviceRecommendationId: "governance_advisor_coordination",
    ruleName: "Advisor coordination (UI)",
    description: "Siloed or informal advisor coordination",
    triggerConditions: [
      { type: "answer_match", questionId: "dc-06", operator: "equals", value: "siloed", weight: 3 },
      { type: "answer_match", questionId: "dma-08", operator: "in", value: ["none", "informal"], weight: 2 },
    ],
    priority: 86,
  },
  {
    id: "fg_ui_succession_planning",
    serviceRecommendationId: "governance_succession_planning",
    ruleName: "Next generation preparation (UI)",
    description: "No formal meetings or successor preparation visible in the worksheet",
    triggerConditions: [
      { type: "answer_match", questionId: "dc-01", operator: "in", value: ["never", "ad-hoc"], weight: 3 },
      { type: "answer_match", questionId: "dma-03", operator: "equals", value: "no", weight: 2 },
    ],
    priority: 81,
  },
  {
    id: "fg_ui_physical_assessment",
    serviceRecommendationId: "physical_security_assessment",
    ruleName: "Physical security assessment (UI)",
    triggerConditions: [
      { type: "answer_match", questionId: "phys-01", operator: "equals", value: 0, weight: 4 },
      { type: "score_threshold", pillarId: "family-governance", operator: "less_than", value: 1.5, weight: 2 },
    ],
    priority: 91,
  },
  {
    id: "fg_ui_physical_implementation",
    serviceRecommendationId: "physical_security_implementation",
    ruleName: "Physical security implementation (UI)",
    triggerConditions: [
      { type: "answer_match", questionId: "phys-01", operator: "equals", value: 0, weight: 3 },
      { type: "answer_match", questionId: "phys-03", operator: "in", value: ["none", "ad-hoc"], weight: 3 },
    ],
    priority: 86,
  },
  {
    id: "fg_ui_emergency_planning",
    serviceRecommendationId: "physical_emergency_planning",
    ruleName: "Emergency planning (UI)",
    triggerConditions: [
      { type: "answer_match", questionId: "phys-05", operator: "in", value: ["none", "informal"], weight: 3 },
      { type: "answer_match", questionId: "env-02", operator: "equals", value: "none", weight: 3 },
    ],
    priority: 81,
  },
  {
    id: "fg_ui_insurance_review",
    serviceRecommendationId: "insurance_comprehensive_review",
    ruleName: "Insurance / medical preparedness review (UI)",
    triggerConditions: [
      { type: "answer_match", questionId: "env-04", operator: "equals", value: 0, weight: 3 },
      { type: "answer_match", questionId: "health-04", operator: "equals", value: "never", weight: 3 },
    ],
    priority: 91,
  },
  {
    id: "fg_ui_estate_planning",
    serviceRecommendationId: "insurance_estate_planning",
    ruleName: "Estate planning update (UI)",
    triggerConditions: [
      { type: "answer_match", questionId: "teg-06", operator: "in", value: ["unknown", "5-10-years"], weight: 4 },
      { type: "score_threshold", pillarId: "family-governance", operator: "less_than", value: 2.0, weight: 2 },
    ],
    priority: 86,
  },
  {
    id: "fg_ui_asset_protection",
    serviceRecommendationId: "insurance_asset_protection",
    ruleName: "Asset protection (UI)",
    triggerConditions: [
      { type: "answer_match", questionId: "mrr-03", operator: "equals", value: "none", weight: 3 },
      { type: "answer_match", questionId: "mrr-01", operator: "equals", value: "none", weight: 3 },
    ],
    priority: 81,
  },
  {
    id: "fg_ui_geographic_assessment",
    serviceRecommendationId: "geographic_risk_assessment",
    ruleName: "Geographic risk assessment (UI)",
    triggerConditions: [
      { type: "answer_match", questionId: "env-01", operator: "equals", value: 0, weight: 4 },
    ],
    priority: 86,
  },
  {
    id: "fg_ui_climate_resilience",
    serviceRecommendationId: "geographic_climate_resilience",
    ruleName: "Climate / continuity resilience (UI)",
    triggerConditions: [
      { type: "answer_match", questionId: "env-05", operator: "equals", value: "no", weight: 3 },
      { type: "answer_match", questionId: "env-04", operator: "equals", value: 0, weight: 2 },
    ],
    priority: 81,
  },
  {
    id: "fg_ui_geographic_diversification",
    serviceRecommendationId: "geographic_diversification",
    ruleName: "Geographic diversification (UI)",
    triggerConditions: [
      { type: "answer_match", questionId: "env-03", operator: "equals", value: "never", weight: 3 },
      { type: "score_threshold", pillarId: "family-governance", operator: "less_than", value: 1.8, weight: 2 },
    ],
    priority: 76,
  },
  {
    id: "fg_ui_reputation_management",
    serviceRecommendationId: "social_reputation_management",
    ruleName: "Reputation management (UI)",
    triggerConditions: [
      { type: "answer_match", questionId: "bs-04", operator: "in", value: ["none", "informal"], weight: 3 },
      { type: "answer_match", questionId: "bs-02", operator: "equals", value: 0, weight: 2 },
    ],
    priority: 86,
  },
  {
    id: "fg_ui_social_media_governance",
    serviceRecommendationId: "social_media_governance",
    ruleName: "Social media governance (UI)",
    triggerConditions: [
      { type: "answer_match", questionId: "bs-04", operator: "in", value: ["none", "informal"], weight: 4 },
    ],
    priority: 81,
  },
  {
    id: "fg_ui_crisis_communication",
    serviceRecommendationId: "social_crisis_response",
    ruleName: "Crisis communication (UI)",
    triggerConditions: [
      { type: "answer_match", questionId: "bs-05", operator: "equals", value: "avoided", weight: 4 },
    ],
    priority: 76,
  },
  {
    id: "fg_ui_cyber_uplift",
    serviceRecommendationId: "cyber_security_uplift",
    ruleName: "Cybersecurity uplift (UI)",
    triggerConditions: [
      { type: "answer_match", questionId: "ac-03", operator: "equals", value: "no", weight: 3 },
      { type: "answer_match", questionId: "cyber-dh-01", operator: "equals", value: 0, weight: 3 },
    ],
    priority: 88,
  },
];

/** Services expected when every visible family-governance answer is at lowest maturity / "no". */
export const FAMILY_GOVERNANCE_ALL_NO_EXPECTED_SERVICE_IDS = [
  "governance_family_charter",
  "governance_advisor_coordination",
  "governance_succession_planning",
  "physical_security_assessment",
  "physical_security_implementation",
  "physical_emergency_planning",
  "insurance_comprehensive_review",
  "insurance_estate_planning",
  "insurance_asset_protection",
  "geographic_risk_assessment",
  "geographic_climate_resilience",
  "geographic_diversification",
  "social_reputation_management",
  "social_media_governance",
  "social_crisis_response",
  "cyber_security_uplift",
] as const;

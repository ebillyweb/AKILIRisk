/**
 * Recommendation rules keyed to the Belvedere pillar question bank (DB / workbook).
 * Question ids align with `test-fixtures/belvedere-pillar-questions.ts` for unit tests.
 */

import type { RecommendationCondition } from "./recommendation-engine";
import { BELVEDERE_TEST_QUESTION_IDS as Q } from "@/lib/assessment/test-fixtures/belvedere-pillar-questions";

export type FamilyGovernanceUiRule = {
  id: string;
  serviceRecommendationId: string;
  ruleName: string;
  description?: string;
  triggerConditions: RecommendationCondition[];
  priority: number;
};

/** Optional cyber catalog entry for workbook gaps (MFA, password manager, etc.). */
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

export const FAMILY_GOVERNANCE_UI_RECOMMENDATION_RULES: FamilyGovernanceUiRule[] = [
  {
    id: "fg_ui_governance_charter",
    serviceRecommendationId: "governance_family_charter",
    ruleName: "Family charter (Belvedere governance)",
    description: "No formal governance body or written family standards",
    triggerConditions: [
      { type: "answer_match", questionId: Q.govA2, operator: "equals", value: 0, weight: 3 },
      { type: "answer_match", questionId: Q.govA6, operator: "equals", value: 0, weight: 3 },
      { type: "score_threshold", pillarId: "governance", operator: "less_than", value: 1.5, weight: 2 },
    ],
    priority: 96,
  },
  {
    id: "fg_ui_advisor_coordination",
    serviceRecommendationId: "governance_advisor_coordination",
    ruleName: "Advisor coordination (Belvedere)",
    triggerConditions: [
      { type: "answer_match", questionId: Q.govA5, operator: "equals", value: 0, weight: 3 },
    ],
    priority: 86,
  },
  {
    id: "fg_ui_succession_planning",
    serviceRecommendationId: "governance_succession_planning",
    ruleName: "Next generation preparation (Belvedere)",
    triggerConditions: [
      { type: "answer_match", questionId: Q.govA3, operator: "equals", value: 0, weight: 3 },
      { type: "answer_match", questionId: Q.govB4, operator: "equals", value: 0, weight: 2 },
    ],
    priority: 81,
  },
  {
    id: "fg_ui_physical_assessment",
    serviceRecommendationId: "physical_security_assessment",
    ruleName: "Physical security assessment (Belvedere)",
    triggerConditions: [
      { type: "answer_match", questionId: Q.physA1, operator: "equals", value: 0, weight: 4 },
      { type: "score_threshold", pillarId: "physical-security", operator: "less_than", value: 1.5, weight: 2 },
    ],
    priority: 91,
  },
  {
    id: "fg_ui_physical_implementation",
    serviceRecommendationId: "physical_security_implementation",
    ruleName: "Physical security implementation (Belvedere)",
    triggerConditions: [
      { type: "answer_match", questionId: Q.physA1, operator: "equals", value: 0, weight: 3 },
      { type: "answer_match", questionId: Q.physB2, operator: "in", value: [0, 1], weight: 3 },
    ],
    priority: 86,
  },
  {
    id: "fg_ui_emergency_planning",
    serviceRecommendationId: "physical_emergency_planning",
    ruleName: "Emergency planning (Belvedere)",
    triggerConditions: [
      { type: "answer_match", questionId: Q.physE1, operator: "in", value: [0, 1], weight: 3 },
      { type: "answer_match", questionId: Q.geoEnv02, operator: "equals", value: 0, weight: 3 },
    ],
    priority: 81,
  },
  {
    id: "fg_ui_insurance_review",
    serviceRecommendationId: "insurance_comprehensive_review",
    ruleName: "Insurance / medical preparedness review (Belvedere)",
    triggerConditions: [
      { type: "answer_match", questionId: Q.insEnv04, operator: "equals", value: 0, weight: 3 },
      { type: "answer_match", questionId: Q.insHealth04, operator: "equals", value: 0, weight: 3 },
    ],
    priority: 91,
  },
  {
    id: "fg_ui_estate_planning",
    serviceRecommendationId: "insurance_estate_planning",
    ruleName: "Estate planning update (Belvedere)",
    triggerConditions: [
      { type: "answer_match", questionId: Q.govB1, operator: "in", value: [0, 1], weight: 4 },
      { type: "score_threshold", pillarId: "insurance", operator: "less_than", value: 2.0, weight: 2 },
    ],
    priority: 86,
  },
  {
    id: "fg_ui_asset_protection",
    serviceRecommendationId: "insurance_asset_protection",
    ruleName: "Asset protection (Belvedere)",
    triggerConditions: [
      { type: "answer_match", questionId: Q.insMrr03, operator: "equals", value: 0, weight: 3 },
      { type: "answer_match", questionId: Q.insMrr01, operator: "equals", value: 0, weight: 3 },
    ],
    priority: 81,
  },
  {
    id: "fg_ui_geographic_assessment",
    serviceRecommendationId: "geographic_risk_assessment",
    ruleName: "Geographic risk assessment (Belvedere)",
    triggerConditions: [
      { type: "answer_match", questionId: Q.geoEnv01, operator: "equals", value: 0, weight: 4 },
    ],
    priority: 86,
  },
  {
    id: "fg_ui_climate_resilience",
    serviceRecommendationId: "geographic_climate_resilience",
    ruleName: "Climate / continuity resilience (Belvedere)",
    triggerConditions: [
      { type: "answer_match", questionId: Q.geoEnv05, operator: "equals", value: "no", weight: 3 },
      { type: "answer_match", questionId: Q.geoEnv04, operator: "equals", value: 0, weight: 2 },
    ],
    priority: 81,
  },
  {
    id: "fg_ui_geographic_diversification",
    serviceRecommendationId: "geographic_diversification",
    ruleName: "Geographic diversification (Belvedere)",
    triggerConditions: [
      { type: "answer_match", questionId: Q.geoEnv03, operator: "equals", value: 0, weight: 3 },
      { type: "score_threshold", pillarId: "geographic-environmental", operator: "less_than", value: 1.8, weight: 2 },
    ],
    priority: 76,
  },
  {
    id: "fg_ui_reputation_management",
    serviceRecommendationId: "social_reputation_management",
    ruleName: "Reputation management (Belvedere)",
    triggerConditions: [
      { type: "answer_match", questionId: Q.repBs04, operator: "in", value: [0, 1], weight: 3 },
      { type: "answer_match", questionId: Q.repBs02, operator: "equals", value: 0, weight: 2 },
    ],
    priority: 86,
  },
  {
    id: "fg_ui_social_media_governance",
    serviceRecommendationId: "social_media_governance",
    ruleName: "Social media governance (Belvedere)",
    triggerConditions: [
      { type: "answer_match", questionId: Q.repBs04, operator: "in", value: [0, 1], weight: 4 },
    ],
    priority: 81,
  },
  {
    id: "fg_ui_crisis_communication",
    serviceRecommendationId: "social_crisis_response",
    ruleName: "Crisis communication (Belvedere)",
    triggerConditions: [
      { type: "answer_match", questionId: Q.repBs05, operator: "equals", value: 0, weight: 4 },
    ],
    priority: 76,
  },
  {
    id: "fg_ui_cyber_uplift",
    serviceRecommendationId: "cyber_security_uplift",
    ruleName: "Cybersecurity uplift (Belvedere)",
    triggerConditions: [
      { type: "answer_match", questionId: Q.cyberA3, operator: "equals", value: "no", weight: 3 },
      { type: "answer_match", questionId: Q.cyberDh01, operator: "equals", value: 0, weight: 3 },
    ],
    priority: 88,
  },

  // Liquidity-Cash rules
  {
    id: "fg_ui_liquidity_reserves",
    serviceRecommendationId: "liquidity_cash_reserve_planning",
    ruleName: "Cash reserve planning (Belvedere)",
    description: "No documented emergency liquidity reserve",
    triggerConditions: [
      { type: "answer_match", questionId: Q.liqA1, operator: "equals", value: 0, weight: 4 },
      { type: "score_threshold", pillarId: "liquidity-cash", operator: "less_than", value: 1.5, weight: 3 },
    ],
    priority: 91,
  },
  {
    id: "fg_ui_liquidity_credit",
    serviceRecommendationId: "liquidity_credit_line_review",
    ruleName: "Credit facility review (Belvedere)",
    description: "Credit lines not documented or reviewed",
    triggerConditions: [
      { type: "answer_match", questionId: Q.liqA2, operator: "equals", value: 0, weight: 4 },
    ],
    priority: 86,
  },
  {
    id: "fg_ui_liquidity_concentration",
    serviceRecommendationId: "liquidity_concentration_stress_test",
    ruleName: "Illiquid concentration stress test (Belvedere)",
    description: "Illiquid concentration not stress-tested",
    triggerConditions: [
      { type: "answer_match", questionId: Q.liqA3, operator: "equals", value: 0, weight: 4 },
      { type: "score_threshold", pillarId: "liquidity-cash", operator: "less_than", value: 1.8, weight: 3 },
    ],
    priority: 81,
  },

  // Tax-Exposure rules
  {
    id: "fg_ui_tax_residency",
    serviceRecommendationId: "tax_residency_review",
    ruleName: "Tax residency review (Belvedere)",
    description: "Tax residency posture not documented or reviewed",
    triggerConditions: [
      { type: "answer_match", questionId: Q.taxA1, operator: "equals", value: 0, weight: 4 },
    ],
    priority: 91,
  },
  {
    id: "fg_ui_tax_event_modeling",
    serviceRecommendationId: "tax_liquidity_event_modeling",
    ruleName: "Pre-event tax modeling (Belvedere)",
    description: "Tax impacts not modeled before liquidity events",
    triggerConditions: [
      { type: "answer_match", questionId: Q.taxA2, operator: "equals", value: 0, weight: 4 },
    ],
    priority: 86,
  },
  {
    id: "fg_ui_tax_estate_exposure",
    serviceRecommendationId: "tax_estate_exposure_mapping",
    ruleName: "Estate tax exposure mapping (Belvedere)",
    description: "Estate-tax exposure not mapped across entities",
    triggerConditions: [
      { type: "answer_match", questionId: Q.taxA3, operator: "equals", value: 0, weight: 4 },
      { type: "score_threshold", pillarId: "tax-exposure", operator: "less_than", value: 2.0, weight: 3 },
    ],
    priority: 81,
  },

  // Estate-Succession rules
  {
    id: "fg_ui_estate_documents",
    serviceRecommendationId: "estate_document_review",
    ruleName: "Estate document currency review (Belvedere)",
    description: "Wills, trusts, or powers of attorney stale or inaccessible",
    triggerConditions: [
      { type: "answer_match", questionId: Q.estA1, operator: "equals", value: 0, weight: 4 },
    ],
    priority: 91,
  },
  {
    id: "fg_ui_estate_beneficiaries",
    serviceRecommendationId: "estate_beneficiary_audit",
    ruleName: "Beneficiary designation audit (Belvedere)",
    description: "Beneficiary designations not aligned across accounts",
    triggerConditions: [
      { type: "answer_match", questionId: Q.estA2, operator: "equals", value: 0, weight: 4 },
    ],
    priority: 86,
  },
  {
    id: "fg_ui_estate_succession",
    serviceRecommendationId: "estate_succession_protocol",
    ruleName: "Business succession protocol (Belvedere)",
    description: "No documented succession protocol for key principals",
    triggerConditions: [
      { type: "answer_match", questionId: Q.estA3, operator: "equals", value: 0, weight: 4 },
      { type: "score_threshold", pillarId: "estate-succession", operator: "less_than", value: 1.5, weight: 3 },
    ],
    priority: 81,
  },

  // AI & Emerging Tech Risk rules
  // The pillar slug is the legacy identifier `family-governance-behavioral`
  // (now presented as "AI & Emerging Tech Risk"). These rules are
  // score-threshold-only ON PURPOSE: at runtime `answer_match` conditions
  // never fire for this bank (answers are keyed by per-DB question UUIDs, not
  // stable ids), so score thresholds keyed on the pillar slug are the only
  // conditions that trigger in production. Thresholds are tiered so a weaker
  // AI-risk posture surfaces more remediation services.
  {
    id: "fg_ui_ai_impersonation_defense",
    serviceRecommendationId: "ai_impersonation_defense",
    ruleName: "AI impersonation & deepfake defense (Belvedere)",
    description: "AI-enabled impersonation and deepfake fraud defenses underdeveloped",
    triggerConditions: [
      { type: "score_threshold", pillarId: "family-governance-behavioral", operator: "less_than", value: 2.0, weight: 1 },
    ],
    priority: 91,
  },
  {
    id: "fg_ui_ai_data_governance",
    serviceRecommendationId: "ai_data_governance",
    ruleName: "AI tool data governance (Belvedere)",
    description: "No policy governing sensitive-data exposure to AI tools",
    triggerConditions: [
      { type: "score_threshold", pillarId: "family-governance-behavioral", operator: "less_than", value: 1.75, weight: 1 },
    ],
    priority: 86,
  },
  {
    id: "fg_ui_ai_synthetic_media",
    serviceRecommendationId: "ai_synthetic_media_response",
    ruleName: "Synthetic media monitoring & response (Belvedere)",
    description: "No monitoring or response plan for synthetic-media reputational attacks",
    triggerConditions: [
      { type: "score_threshold", pillarId: "family-governance-behavioral", operator: "less_than", value: 1.5, weight: 1 },
    ],
    priority: 81,
  },
];

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
  "liquidity_cash_reserve_planning",
  "liquidity_credit_line_review",
  "liquidity_concentration_stress_test",
  "tax_residency_review",
  "tax_liquidity_event_modeling",
  "tax_estate_exposure_mapping",
  "estate_document_review",
  "estate_beneficiary_audit",
  "estate_succession_protocol",
  "ai_impersonation_defense",
  "ai_data_governance",
  "ai_synthetic_media_response",
] as const;

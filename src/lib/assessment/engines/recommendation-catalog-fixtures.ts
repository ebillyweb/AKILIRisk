/**
 * Production-aligned recommendation catalog for tests.
 *
 * Mirrors `scripts/setup-all-pillar-rules.ts` (legacy import rules + UI bank
 * rules from `family-governance-recommendation-rules.ts`). When seed values
 * change, update the UI rules module first; fixtures re-export it here.
 */

import {
  CYBER_SECURITY_UPLIFT_SERVICE,
  FAMILY_GOVERNANCE_ALL_NO_EXPECTED_SERVICE_IDS,
  FAMILY_GOVERNANCE_UI_RECOMMENDATION_RULES,
} from "./family-governance-recommendation-rules";
import type { RecommendationCondition } from "./recommendation-engine";

export { FAMILY_GOVERNANCE_ALL_NO_EXPECTED_SERVICE_IDS };

export type CatalogService = {
  id: string;
  name: string;
  description: string;
  category: string;
  priority: number;
  estimatedCost?: string;
  timeframe?: string;
  provider?: string;
};

export type CatalogRule = {
  id: string;
  serviceRecommendationId: string;
  ruleName: string;
  triggerConditions: RecommendationCondition[];
  priority: number;
};

/** Worst-case answers from `examples/complete-assessment-example.ts` (highRiskFamily). */
export const HIGH_RISK_FAMILY_ANSWERS: Record<string, unknown> = {
  governance_decision_authority: "unclear_undefined",
  governance_family_charter: "none",
  governance_next_gen_engagement: "no_preparation",
  governance_advisor_coordination: "siloed",
  governance_conflict_resolution: "none",
  governance_family_meetings: "never",

  cyber_a_password_device_management: "no_ownership",
  cyber_a_family_online_rules: "none",
  cyber_c_password_manager: "reused_simple",
  cyber_c_mfa_enabled: "none",

  physical_home_security: "basic_minimal",
  physical_travel_security: "none",
  physical_staff_vetting: "none",
  physical_emergency_plans: "none",
  physical_information_protection: "minimal",

  insurance_coverage_review: "never",
  insurance_umbrella_coverage: "basic",
  insurance_asset_titling: "individual",
  insurance_estate_planning: "none_outdated",
  insurance_business_protection: "minimal",

  geographic_location_assessment: "not_assessed",
  geographic_climate_preparedness: "unprepared",
  geographic_political_stability: "not_considered",
  geographic_regulatory_compliance: "limited",
  geographic_diversification: "concentrated",

  social_media_policies: "none",
  social_public_exposure: "unmanaged",
  social_family_conduct: "none",
  social_crisis_communication: "none",
  social_staff_confidentiality: "none",

  // Liquidity-Cash
  liquidity_cash_reserves: "none",
  liquidity_credit_facilities: "none",
  liquidity_concentration: "concentrated",

  // Tax-Exposure
  tax_residency_posture: "none",
  tax_event_modeling: "none",
  tax_estate_mapping: "none",

  // Estate-Succession
  estate_document_currency: "none_outdated",
  estate_beneficiary_alignment: "none",
  estate_succession_protocol: "none",

  // Behavioral Resilience
  behavioral_family_meetings: "none",
  behavioral_decision_rights: "none",
  behavioral_investment_discipline: "none",
};

/** Strong-control answers from `examples/complete-assessment-example.ts` (lowRiskFamily). */
export const LOW_RISK_FAMILY_ANSWERS: Record<string, unknown> = {
  governance_decision_authority: "family_council",
  governance_family_charter: "comprehensive_reviewed",
  governance_next_gen_engagement: "leadership_pipeline",
  governance_advisor_coordination: "integrated_team",
  governance_conflict_resolution: "formal_process",
  governance_family_meetings: "quarterly",

  physical_home_security: "executive_protection",
  physical_travel_security: "professional",
  physical_staff_vetting: "ongoing",
  physical_emergency_plans: "tested",
  physical_information_protection: "professional_grade",

  insurance_coverage_review: "annual",
  insurance_umbrella_coverage: "comprehensive",
  insurance_asset_titling: "sophisticated",
  insurance_estate_planning: "dynamic_updated",
  insurance_business_protection: "sophisticated",

  geographic_location_assessment: "comprehensive_ongoing",
  geographic_climate_preparedness: "resilient_systems",
  geographic_political_stability: "dynamic_planning",
  geographic_regulatory_compliance: "expert_managed",
  geographic_diversification: "well_diversified",

  social_media_policies: "comprehensive",
  social_public_exposure: "professional",
  social_family_conduct: "enforced",
  social_crisis_communication: "professional",
  social_staff_confidentiality: "comprehensive",

  // Liquidity-Cash
  liquidity_cash_reserves: "active_stress_tested",
  liquidity_credit_facilities: "active_stress_tested",
  liquidity_concentration: "well_diversified",

  // Tax-Exposure
  tax_residency_posture: "proactive",
  tax_event_modeling: "proactive",
  tax_estate_mapping: "comprehensive",

  // Estate-Succession
  estate_document_currency: "current_multi_jurisdictional",
  estate_beneficiary_alignment: "comprehensive",
  estate_succession_protocol: "comprehensive",

  // Behavioral Resilience
  behavioral_family_meetings: "active_enforced",
  behavioral_decision_rights: "active_enforced",
  behavioral_investment_discipline: "active_enforced",
};

/** Pillar score keys used by seeded rules (`pillarId` in triggerConditions). */
export const HIGH_RISK_PILLAR_SCORES: Record<string, { score: number; riskLevel: "critical" | "high" }> = {
  governance: { score: 0.8, riskLevel: "critical" },
  "physical-security": { score: 0.5, riskLevel: "critical" },
  insurance: { score: 0.6, riskLevel: "critical" },
  "geographic-environmental": { score: 0.7, riskLevel: "critical" },
  "reputational-social": { score: 0.6, riskLevel: "critical" },
  "liquidity-cash": { score: 0.5, riskLevel: "critical" },
  "tax-exposure": { score: 0.6, riskLevel: "critical" },
  "estate-succession": { score: 0.5, riskLevel: "critical" },
  "ai-emerging-tech": { score: 0.7, riskLevel: "critical" },
};

export const GOVERNANCE_REMEDIATION_SERVICE_IDS = [
  "governance_family_charter",
  "governance_advisor_coordination",
  "governance_succession_planning",
] as const;

export const HIGH_RISK_EXPECTED_SERVICE_IDS = [
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
  "ai_operations_oversight",
  "ai_household_literacy",
  "ai_risk_governance",
] as const;

export const PRODUCTION_CATALOG_SERVICES: CatalogService[] = [
  {
    id: "governance_family_charter",
    name: "Family Governance Charter Development",
    description: "Professional facilitation to create comprehensive family governance charter and decision-making framework",
    category: "governance",
    priority: 95,
    estimatedCost: "$15,000 - $40,000",
    timeframe: "2-4 months",
    provider: "Family Governance Consultants",
  },
  {
    id: "governance_advisor_coordination",
    name: "Advisor Coordination and Integration",
    description: "Establishment of coordinated advisory team with regular communication protocols",
    category: "governance",
    priority: 85,
    estimatedCost: "$8,000 - $20,000",
    timeframe: "1-2 months",
  },
  {
    id: "governance_succession_planning",
    name: "Next Generation Development Program",
    description: "Comprehensive program to prepare next generation for governance responsibilities",
    category: "governance",
    priority: 80,
    estimatedCost: "$25,000 - $75,000",
    timeframe: "6-12 months",
  },
  {
    id: "physical_security_assessment",
    name: "Comprehensive Security Assessment",
    description: "Professional security assessment of all family locations and protocols",
    category: "security",
    priority: 90,
    estimatedCost: "$10,000 - $25,000",
    timeframe: "2-4 weeks",
  },
  {
    id: "physical_security_implementation",
    name: "Executive Security Implementation",
    description: "Implementation of comprehensive physical security measures and protocols",
    category: "security",
    priority: 85,
    estimatedCost: "$50,000 - $200,000",
    timeframe: "1-3 months",
  },
  {
    id: "physical_emergency_planning",
    name: "Emergency Response Planning",
    description: "Development of comprehensive emergency response and evacuation procedures",
    category: "security",
    priority: 80,
    estimatedCost: "$5,000 - $15,000",
    timeframe: "3-6 weeks",
  },
  {
    id: "insurance_comprehensive_review",
    name: "Comprehensive Insurance Review",
    description: "Complete review and optimization of all insurance coverage with gap analysis",
    category: "insurance",
    priority: 90,
    estimatedCost: "$5,000 - $15,000",
    timeframe: "2-4 weeks",
  },
  {
    id: "insurance_estate_planning",
    name: "Advanced Estate Planning",
    description: "Comprehensive estate planning with tax optimization and asset protection strategies",
    category: "legal",
    priority: 85,
    estimatedCost: "$25,000 - $100,000",
    timeframe: "3-6 months",
  },
  {
    id: "insurance_asset_protection",
    name: "Asset Protection Strategy",
    description: "Implementation of sophisticated asset protection and liability mitigation strategies",
    category: "legal",
    priority: 80,
    estimatedCost: "$35,000 - $150,000",
    timeframe: "4-8 months",
  },
  {
    id: "geographic_risk_assessment",
    name: "Geographic Risk Assessment",
    description: "Comprehensive assessment of location-specific risks across all family locations",
    category: "advisory",
    priority: 85,
    estimatedCost: "$8,000 - $20,000",
    timeframe: "3-6 weeks",
  },
  {
    id: "geographic_climate_resilience",
    name: "Climate Resilience Planning",
    description: "Development of climate risk mitigation and adaptation strategies",
    category: "advisory",
    priority: 80,
    estimatedCost: "$15,000 - $40,000",
    timeframe: "2-4 months",
  },
  {
    id: "geographic_diversification",
    name: "Geographic Diversification Strategy",
    description: "Strategic planning for geographic diversification of assets and residences",
    category: "advisory",
    priority: 75,
    estimatedCost: "$20,000 - $50,000",
    timeframe: "3-6 months",
  },
  {
    id: "social_reputation_management",
    name: "Family Reputation Management",
    description: "Comprehensive reputation monitoring and management program",
    category: "reputation",
    priority: 85,
    estimatedCost: "$12,000 - $30,000",
    timeframe: "Ongoing",
  },
  {
    id: "social_media_governance",
    name: "Digital Governance and Social Media Policy",
    description: "Development of family digital governance policies and social media guidelines",
    category: "reputation",
    priority: 80,
    estimatedCost: "$5,000 - $15,000",
    timeframe: "2-6 weeks",
  },
  {
    id: "social_crisis_response",
    name: "Crisis Communication Planning",
    description: "Development of comprehensive crisis communication and reputation recovery strategies",
    category: "reputation",
    priority: 75,
    estimatedCost: "$10,000 - $25,000",
    timeframe: "4-8 weeks",
  },

  // Liquidity-Cash services
  {
    id: "liquidity_cash_reserve_planning",
    name: "Cash Reserve and Liquidity Planning",
    description: "Professional facilitation to establish documented emergency liquidity reserves and replenishment protocols",
    category: "financial",
    priority: 90,
    estimatedCost: "$10,000 - $25,000",
    timeframe: "2-4 weeks",
  },
  {
    id: "liquidity_credit_line_review",
    name: "Credit Facility Review and Optimization",
    description: "Review and optimization of committed credit lines to ensure availability under stress conditions",
    category: "financial",
    priority: 85,
    estimatedCost: "$5,000 - $15,000",
    timeframe: "2-3 weeks",
  },
  {
    id: "liquidity_concentration_stress_test",
    name: "Illiquid Concentration Stress Testing",
    description: "Stress-testing of illiquid wealth concentration against near-term capital calls and tax obligations",
    category: "financial",
    priority: 80,
    estimatedCost: "$15,000 - $40,000",
    timeframe: "1-2 months",
  },

  // Tax-Exposure services
  {
    id: "tax_residency_review",
    name: "Tax Residency and Filing Posture Review",
    description: "Annual documentation and review of tax residency posture with qualified counsel",
    category: "financial",
    priority: 90,
    estimatedCost: "$10,000 - $30,000",
    timeframe: "2-4 weeks",
  },
  {
    id: "tax_liquidity_event_modeling",
    name: "Pre-Event Tax Impact Modeling",
    description: "Proactive modeling of AMT, NIIT, and state-tax impacts before major liquidity events",
    category: "financial",
    priority: 85,
    estimatedCost: "$8,000 - $25,000",
    timeframe: "2-3 weeks",
  },
  {
    id: "tax_estate_exposure_mapping",
    name: "Estate Tax Exposure Mapping",
    description: "Comprehensive mapping of estate-tax exposure across entities, trusts, and beneficiary designations",
    category: "financial",
    priority: 80,
    estimatedCost: "$15,000 - $50,000",
    timeframe: "1-3 months",
  },

  // Estate-Succession services
  {
    id: "estate_document_review",
    name: "Estate Document Currency Review",
    description: "Review of wills, trusts, and powers of attorney to confirm currency, signatures, and accessible storage",
    category: "legal",
    priority: 90,
    estimatedCost: "$5,000 - $20,000",
    timeframe: "2-4 weeks",
  },
  {
    id: "estate_beneficiary_audit",
    name: "Beneficiary Designation Audit",
    description: "Audit of beneficiary designations across retirement accounts, insurance, and transfer-on-death registrations",
    category: "legal",
    priority: 85,
    estimatedCost: "$3,000 - $10,000",
    timeframe: "1-2 weeks",
  },
  {
    id: "estate_succession_protocol",
    name: "Business Succession Protocol Development",
    description: "Development of documented business or family-enterprise succession protocol for key principals",
    category: "legal",
    priority: 80,
    estimatedCost: "$25,000 - $75,000",
    timeframe: "3-6 months",
  },

  // AI & Emerging Tech Risk services
  {
    id: "ai_impersonation_defense",
    name: "AI Impersonation & Deepfake Defense Program",
    description: "Out-of-band verification protocols, family code words, and staff training to defend against deepfake and voice-clone fraud",
    category: "security",
    priority: 90,
    estimatedCost: "$10,000 - $30,000",
    timeframe: "1-3 months",
  },
  {
    id: "ai_data_governance",
    name: "AI Tool Data Governance Program",
    description: "Acceptable-use policy, vendor vetting, and upload controls governing what family and office data may be entered into AI tools",
    category: "advisory",
    priority: 85,
    estimatedCost: "$8,000 - $25,000",
    timeframe: "1-2 months",
  },
  {
    id: "ai_synthetic_media_response",
    name: "Synthetic Media Monitoring & Response Program",
    description: "Monitoring for AI-generated impersonation plus a rapid takedown and communications playbook for synthetic-media reputational attacks",
    category: "reputation",
    priority: 80,
    estimatedCost: "$15,000 - $45,000",
    timeframe: "2-4 months",
  },
  {
    id: "ai_operations_oversight",
    name: "AI Operations Oversight & Validation",
    description: "Human-oversight controls and independent validation for AI used in investment research, accounting, and legal work in the family office",
    category: "advisory",
    priority: 78,
    estimatedCost: "$12,000 - $35,000",
    timeframe: "2-3 months",
  },
  {
    id: "ai_household_literacy",
    name: "Household AI Safety & Literacy Program",
    description: "Guidance and education for family members on safe AI-tool use, smart-device privacy, and AI-enabled scams targeting the young and elderly",
    category: "advisory",
    priority: 76,
    estimatedCost: "$6,000 - $18,000",
    timeframe: "1-2 months",
  },
  {
    id: "ai_risk_governance",
    name: "AI Risk Governance & Incident Response",
    description: "Assigns ownership of AI-risk monitoring, integrates AI risk into the family's risk review, and establishes incident logging and response",
    category: "advisory",
    priority: 74,
    estimatedCost: "$10,000 - $30,000",
    timeframe: "2-4 months",
  },
];

const LEGACY_CATALOG_RULES: CatalogRule[] = [
  {
    id: "governance_charter_needed",
    serviceRecommendationId: "governance_family_charter",
    ruleName: "Family Charter Development",
    triggerConditions: [
      {
        type: "answer_match",
        questionId: "governance_family_charter",
        operator: "in",
        value: ["none", "informal"],
        weight: 4,
      },
      {
        type: "score_threshold",
        pillarId: "governance",
        operator: "less_than",
        value: 2.0,
        weight: 3,
      },
    ],
    priority: 95,
  },
  {
    id: "governance_advisor_coordination",
    serviceRecommendationId: "governance_advisor_coordination",
    ruleName: "Advisor Coordination Improvement",
    triggerConditions: [
      {
        type: "answer_match",
        questionId: "governance_advisor_coordination",
        operator: "in",
        value: ["siloed", "ad_hoc"],
        weight: 3,
      },
    ],
    priority: 85,
  },
  {
    id: "governance_succession_planning",
    serviceRecommendationId: "governance_succession_planning",
    ruleName: "Next Generation Development",
    triggerConditions: [
      {
        type: "answer_match",
        questionId: "governance_next_gen_engagement",
        operator: "in",
        value: ["no_preparation", "informal_exposure"],
        weight: 4,
      },
    ],
    priority: 80,
  },
  {
    id: "physical_security_basic_gaps",
    serviceRecommendationId: "physical_security_assessment",
    ruleName: "Security Assessment for Basic Protection",
    triggerConditions: [
      {
        type: "answer_match",
        questionId: "physical_home_security",
        operator: "equals",
        value: "basic_minimal",
        weight: 4,
      },
      {
        type: "score_threshold",
        pillarId: "physical-security",
        operator: "less_than",
        value: 1.5,
        weight: 3,
      },
    ],
    priority: 90,
  },
  {
    id: "physical_security_comprehensive_needed",
    serviceRecommendationId: "physical_security_implementation",
    ruleName: "Comprehensive Security Implementation",
    triggerConditions: [
      {
        type: "score_threshold",
        pillarId: "physical-security",
        operator: "less_than",
        value: 2.0,
        weight: 4,
      },
      {
        type: "answer_match",
        questionId: "physical_staff_vetting",
        operator: "in",
        value: ["none", "basic"],
        weight: 3,
      },
    ],
    priority: 85,
  },
  {
    id: "physical_emergency_planning_needed",
    serviceRecommendationId: "physical_emergency_planning",
    ruleName: "Emergency Planning Development",
    triggerConditions: [
      {
        type: "answer_match",
        questionId: "physical_emergency_plans",
        operator: "in",
        value: ["none", "basic"],
        weight: 4,
      },
    ],
    priority: 80,
  },
  {
    id: "insurance_review_overdue",
    serviceRecommendationId: "insurance_comprehensive_review",
    ruleName: "Overdue Insurance Review",
    triggerConditions: [
      {
        type: "answer_match",
        questionId: "insurance_coverage_review",
        operator: "in",
        value: ["never", "crisis_only"],
        weight: 4,
      },
    ],
    priority: 90,
  },
  {
    id: "insurance_estate_planning_needed",
    serviceRecommendationId: "insurance_estate_planning",
    ruleName: "Estate Planning Update",
    triggerConditions: [
      {
        type: "answer_match",
        questionId: "insurance_estate_planning",
        operator: "in",
        value: ["none_outdated", "basic_current"],
        weight: 4,
      },
      {
        type: "score_threshold",
        pillarId: "insurance",
        operator: "less_than",
        value: 2.0,
        weight: 3,
      },
    ],
    priority: 85,
  },
  {
    id: "insurance_asset_protection_needed",
    serviceRecommendationId: "insurance_asset_protection",
    ruleName: "Asset Protection Implementation",
    triggerConditions: [
      {
        type: "answer_match",
        questionId: "insurance_asset_titling",
        operator: "in",
        value: ["individual", "joint_simple"],
        weight: 4,
      },
      {
        type: "answer_match",
        questionId: "insurance_umbrella_coverage",
        operator: "in",
        value: ["none", "basic"],
        weight: 3,
      },
    ],
    priority: 80,
  },
  {
    id: "geographic_assessment_needed",
    serviceRecommendationId: "geographic_risk_assessment",
    ruleName: "Geographic Risk Assessment",
    triggerConditions: [
      {
        type: "answer_match",
        questionId: "geographic_location_assessment",
        operator: "in",
        value: ["not_assessed", "basic_awareness"],
        weight: 4,
      },
    ],
    priority: 85,
  },
  {
    id: "geographic_climate_resilience_needed",
    serviceRecommendationId: "geographic_climate_resilience",
    ruleName: "Climate Resilience Planning",
    triggerConditions: [
      {
        type: "answer_match",
        questionId: "geographic_climate_preparedness",
        operator: "in",
        value: ["unprepared", "basic"],
        weight: 4,
      },
    ],
    priority: 80,
  },
  {
    id: "geographic_diversification_needed",
    serviceRecommendationId: "geographic_diversification",
    ruleName: "Geographic Diversification Strategy",
    triggerConditions: [
      {
        type: "answer_match",
        questionId: "geographic_diversification",
        operator: "equals",
        value: "concentrated",
        weight: 4,
      },
      {
        type: "score_threshold",
        pillarId: "geographic-environmental",
        operator: "less_than",
        value: 1.8,
        weight: 3,
      },
    ],
    priority: 75,
  },
  {
    id: "social_reputation_management_needed",
    serviceRecommendationId: "social_reputation_management",
    ruleName: "Reputation Management Program",
    triggerConditions: [
      {
        type: "answer_match",
        questionId: "social_public_exposure",
        operator: "in",
        value: ["unmanaged", "basic_awareness"],
        weight: 4,
      },
      {
        type: "score_threshold",
        pillarId: "reputational-social",
        operator: "less_than",
        value: 2.0,
        weight: 3,
      },
    ],
    priority: 85,
  },
  {
    id: "social_media_governance_needed",
    serviceRecommendationId: "social_media_governance",
    ruleName: "Social Media Governance",
    triggerConditions: [
      {
        type: "answer_match",
        questionId: "social_media_policies",
        operator: "in",
        value: ["none", "informal"],
        weight: 4,
      },
    ],
    priority: 80,
  },
  {
    id: "social_crisis_planning_needed",
    serviceRecommendationId: "social_crisis_response",
    ruleName: "Crisis Communication Planning",
    triggerConditions: [
      {
        type: "answer_match",
        questionId: "social_crisis_communication",
        operator: "in",
        value: ["none", "basic"],
        weight: 4,
      },
    ],
    priority: 75,
  },

  // Liquidity-Cash legacy rules
  {
    id: "liquidity_reserve_planning_needed",
    serviceRecommendationId: "liquidity_cash_reserve_planning",
    ruleName: "Cash Reserve Planning",
    triggerConditions: [
      { type: "answer_match", questionId: "liquidity_cash_reserves", operator: "in", value: ["none", "informal"], weight: 4 },
      { type: "score_threshold", pillarId: "liquidity-cash", operator: "less_than", value: 1.5, weight: 3 },
    ],
    priority: 90,
  },
  {
    id: "liquidity_credit_line_review_needed",
    serviceRecommendationId: "liquidity_credit_line_review",
    ruleName: "Credit Facility Review",
    triggerConditions: [
      { type: "answer_match", questionId: "liquidity_credit_facilities", operator: "in", value: ["none", "informal"], weight: 4 },
    ],
    priority: 85,
  },
  {
    id: "liquidity_concentration_stress_test_needed",
    serviceRecommendationId: "liquidity_concentration_stress_test",
    ruleName: "Illiquid Concentration Stress Testing",
    triggerConditions: [
      { type: "answer_match", questionId: "liquidity_concentration", operator: "equals", value: "concentrated", weight: 4 },
      { type: "score_threshold", pillarId: "liquidity-cash", operator: "less_than", value: 1.8, weight: 3 },
    ],
    priority: 80,
  },

  // Tax-Exposure legacy rules
  {
    id: "tax_residency_review_needed",
    serviceRecommendationId: "tax_residency_review",
    ruleName: "Tax Residency Review",
    triggerConditions: [
      { type: "answer_match", questionId: "tax_residency_posture", operator: "in", value: ["none", "ad_hoc"], weight: 4 },
      { type: "score_threshold", pillarId: "tax-exposure", operator: "less_than", value: 1.5, weight: 3 },
    ],
    priority: 90,
  },
  {
    id: "tax_event_modeling_needed",
    serviceRecommendationId: "tax_liquidity_event_modeling",
    ruleName: "Pre-Event Tax Impact Modeling",
    triggerConditions: [
      { type: "answer_match", questionId: "tax_event_modeling", operator: "in", value: ["none", "ad_hoc"], weight: 4 },
    ],
    priority: 85,
  },
  {
    id: "tax_estate_mapping_needed",
    serviceRecommendationId: "tax_estate_exposure_mapping",
    ruleName: "Estate Tax Exposure Mapping",
    triggerConditions: [
      { type: "answer_match", questionId: "tax_estate_mapping", operator: "in", value: ["none", "ad_hoc"], weight: 4 },
      { type: "score_threshold", pillarId: "tax-exposure", operator: "less_than", value: 2.0, weight: 3 },
    ],
    priority: 80,
  },

  // Estate-Succession legacy rules
  {
    id: "estate_document_review_needed",
    serviceRecommendationId: "estate_document_review",
    ruleName: "Estate Document Currency Review",
    triggerConditions: [
      { type: "answer_match", questionId: "estate_document_currency", operator: "in", value: ["none_outdated", "partial"], weight: 4 },
      { type: "score_threshold", pillarId: "estate-succession", operator: "less_than", value: 1.5, weight: 3 },
    ],
    priority: 90,
  },
  {
    id: "estate_beneficiary_audit_needed",
    serviceRecommendationId: "estate_beneficiary_audit",
    ruleName: "Beneficiary Designation Audit",
    triggerConditions: [
      { type: "answer_match", questionId: "estate_beneficiary_alignment", operator: "in", value: ["none", "partial"], weight: 4 },
    ],
    priority: 85,
  },
  {
    id: "estate_succession_protocol_needed",
    serviceRecommendationId: "estate_succession_protocol",
    ruleName: "Business Succession Protocol Development",
    triggerConditions: [
      { type: "answer_match", questionId: "estate_succession_protocol", operator: "in", value: ["none", "partial"], weight: 4 },
      { type: "score_threshold", pillarId: "estate-succession", operator: "less_than", value: 1.5, weight: 3 },
    ],
    priority: 80,
  },

  // AI & Emerging Tech Risk rules live in FAMILY_GOVERNANCE_UI_RECOMMENDATION_RULES
  // (spread into PRODUCTION_CATALOG_RULES below). The former Behavioral
  // Resilience legacy rules were removed when the pillar became AI & Emerging
  // Tech Risk.
];

export const PRODUCTION_CATALOG_RULES: CatalogRule[] = [
  ...LEGACY_CATALOG_RULES,
  ...FAMILY_GOVERNANCE_UI_RECOMMENDATION_RULES,
];

const cyberServiceCatalog: CatalogService = {
  id: CYBER_SECURITY_UPLIFT_SERVICE.id,
  name: CYBER_SECURITY_UPLIFT_SERVICE.name,
  description: CYBER_SECURITY_UPLIFT_SERVICE.description,
  category: CYBER_SECURITY_UPLIFT_SERVICE.category,
  priority: CYBER_SECURITY_UPLIFT_SERVICE.priority,
  estimatedCost: CYBER_SECURITY_UPLIFT_SERVICE.estimatedCost,
  timeframe: CYBER_SECURITY_UPLIFT_SERVICE.timeframe,
  provider: CYBER_SECURITY_UPLIFT_SERVICE.provider,
};

export const PRODUCTION_CATALOG_SERVICES_WITH_CYBER: CatalogService[] = [
  ...PRODUCTION_CATALOG_SERVICES,
  cyberServiceCatalog,
];

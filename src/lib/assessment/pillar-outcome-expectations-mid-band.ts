/**
 * Pillar narrative copy for mixed maturity profiles (not all-no / all-yes).
 * Selected by aggregate risk tier: critical, high, medium, or low.
 */

import type { RiskLevel } from "./types";

export type PillarMidBandRiskTier = Extract<
  RiskLevel,
  "critical" | "high" | "medium" | "low"
>;

export type PillarMidBandNarratives = Record<
  PillarMidBandRiskTier,
  readonly string[]
>;

/** Governance — mixed maturity by risk tier. */
export const GOVERNANCE_MID_BAND_NARRATIVES: PillarMidBandNarratives = {
  critical: [
    "The family has begun addressing estate and governance fundamentals, but maturity remains uneven across decision authority, documentation, and advisor alignment. Material gaps still expose the family to ambiguity in asset titling, leadership transitions, and coordinated planning. Prioritize closing the highest-weight deficiencies identified in this assessment while establishing a written governance framework, defined decision rights, and a coordinated advisor team to stabilize the foundation.",
  ],
  high: [
    "Governance practices are emerging but not yet consistent across entities, generations, or advisors. Decision-making, documentation, and succession planning require formalization to reduce reliance on informal understanding. We recommend sequencing remediation around written policies, regular family governance forums, and explicit advisor coordination so improvements are durable rather than person-dependent.",
  ],
  medium: [
    "The family demonstrates moderate governance maturity with identifiable strengths alongside areas that need standardization. Focus next on reinforcing documented practices, clarifying authority for major decisions, and aligning advisors around a single plan for estate structure, succession, and next-generation preparedness. Targeted upgrades in the areas flagged below will move this pillar toward institutionalized governance.",
  ],
  low: [
    "Overall governance maturity is strong, with only isolated gaps relative to best practice. Address the specific deficiencies noted in this assessment to align the framework fully with the family's intent across entities and jurisdictions. Continued periodic review, scenario planning, and next-generation engagement will preserve resilience as complexity grows.",
  ],
};

/** Cyber & digital — mixed maturity by risk tier. */
export const CYBER_DIGITAL_MID_BAND_NARRATIVES: PillarMidBandNarratives = {
  critical: [
    "Cyber hygiene is inconsistently applied across family members, devices, and accounts, leaving meaningful exposure despite some protective measures in place. Foundational controls such as credential management, multi-factor authentication, and device hardening should be standardized household-wide. Implement a coordinated uplift program with monitoring, education, and incident response planning to reduce fraud, account takeover, and data loss risk.",
  ],
  high: [
    "Digital risk management shows partial adoption of recommended controls, but coverage gaps persist across accounts, devices, and household staff. We recommend consolidating policies for passwords, MFA, software updates, and safe online behavior, then validating adherence through periodic reviews. Enhanced monitoring and executive protection services can close visibility gaps that internal practices may miss.",
  ],
  medium: [
    "Cybersecurity practices are generally sound with room to strengthen consistency and response readiness. Focus on closing the specific control gaps identified below, expanding MFA and password management to all high-value accounts, and testing incident response scenarios. Periodic third-party assessments will help validate that protections keep pace with evolving threats.",
  ],
  low: [
    "The household maintains a disciplined approach to digital risk with only minor gaps relative to leading practice. Remediate the isolated items noted in this assessment and sustain routine testing of backups, phishing awareness, and access reviews. Advanced monitoring and penetration testing can further harden defenses as threat activity increases.",
  ],
};

/** Physical security — mixed maturity by risk tier. */
export const PHYSICAL_SECURITY_MID_BAND_NARRATIVES: PillarMidBandNarratives = {
  critical: [
    "Physical security and personal safety practices are fragmented across residences, travel, and staff access, creating elevated exposure despite isolated controls. Establish centralized oversight, baseline residential protections, and documented travel and incident protocols. Professional site assessments and vetting standards for household staff should be prioritized to reduce intrusion and situational risk.",
  ],
  high: [
    "Security measures exist in pockets but lack consistent standards across properties, travel, and personnel. We recommend defining minimum physical security requirements for each residence, formalizing travel security planning, and aligning emergency response procedures with family governance. Coordinated implementation across locations will reduce gaps that arise from ad hoc practices.",
  ],
  medium: [
    "Physical security maturity is moderate, with several controls operating effectively while others remain informal or incomplete. Address the prioritized gaps below—particularly access management, monitoring, and incident response—and validate performance through periodic assessments. Integrating threat awareness into travel and event planning will further strengthen resilience.",
  ],
  low: [
    "Physical security is well managed overall, with targeted opportunities to refine travel protocols, staff vetting, or monitoring coverage. Close the specific items identified in this assessment and conduct periodic independent reviews to stress-test residences and travel plans under coordinated threat scenarios.",
  ],
};

/** Insurance — mixed maturity by risk tier. */
export const INSURANCE_MID_BAND_NARRATIVES: PillarMidBandNarratives = {
  critical: [
    "Insurance and asset-protection planning lacks centralized coordination, producing misalignment between coverage, ownership structures, and risk exposure. A comprehensive coverage audit should be undertaken to validate limits, umbrella/excess layers, and policy coordination across personal, entity, and business activities. Establish renewal tracking and advisor integration so coverage evolves with the balance sheet.",
  ],
  high: [
    "Coverage is in place for core risks but may not fully reflect current asset complexity, liability stacking, or ownership structures. We recommend benchmarking policies against peer families, stress-testing limits for catastrophic scenarios, and aligning estate and insurance planning with qualified advisors. Remediate the high-priority gaps identified below to reduce uninsured loss potential.",
  ],
  medium: [
    "Insurance programs are generally appropriate with refinements needed in coordination, limits, or specialty lines. Focus on the deficiencies noted in this assessment, particularly umbrella/excess adequacy, high-value asset schedules, and claims/documentation discipline. Annual reviews with brokers and wealth advisors will keep programs aligned as assets and activities change.",
  ],
  low: [
    "Insurance structure and governance are strong relative to peers, with narrow gaps to address. Resolve the specific items flagged below and continue periodic independent reviews and scenario modeling for low-probability, high-severity events to validate that limits and exclusions remain fit for purpose.",
  ],
};

/** Geographic / environmental — mixed maturity by risk tier. */
export const GEOGRAPHIC_ENVIRONMENTAL_MID_BAND_NARRATIVES: PillarMidBandNarratives = {
  critical: [
    "Property and environmental risk is not managed systematically across the portfolio, leaving exposure to acute events and long-term climate stressors under-addressed. Implement portfolio-wide hazard mapping, pre-acquisition risk screening, and mitigation planning tied to insurance and capital decisions. Each material property should have a documented resilience plan aligned with regional hazard profiles.",
  ],
  high: [
    "Some geographic and environmental practices are in place, but coverage and rigor vary by property and region. Standardize assessment criteria for acquisitions and renewals, incorporate climate and infrastructure data into decisions, and coordinate mitigation investments with insurers and advisors. Closing the gaps below will reduce correlated loss across the portfolio.",
  ],
  medium: [
    "Geographic risk management is moderately mature with opportunities to strengthen mapping, mitigation, and insurance integration. Prioritize the deficiencies identified in this assessment and conduct periodic portfolio-level reviews for concentration in hazard-prone regions. Independent resilience audits can validate that controls perform as intended over time.",
  ],
  low: [
    "The portfolio demonstrates sound geographic risk awareness with limited gaps to close. Address the specific items noted below and maintain annual re-underwriting of hazard exposure with advisors and carriers as climate conditions and asset footprints evolve.",
  ],
};

/** Reputational & social — mixed maturity by risk tier. */
export const REPUTATIONAL_SOCIAL_MID_BAND_NARRATIVES: PillarMidBandNarratives = {
  critical: [
    "Reputational and social exposure is largely unmanaged across digital presence, affiliations, and crisis readiness, despite some informal practices. A structured program should address search visibility, social media governance, and coordinated response protocols. Digital footprint and narrative reviews will help align public positioning with family intent and reduce amplification risk.",
  ],
  high: [
    "Reputation management efforts are inconsistent, with gaps in monitoring, household conduct standards, or crisis planning. We recommend formalizing social and media policies, clarifying acceptable public engagement for family members and staff, and establishing rapid-response protocols with advisors. Targeted remediation of the issues below will reduce spillover from personal or affiliate activity.",
  ],
  medium: [
    "Reputational maturity is moderate, with several controls effective but not yet institutionalized across the family and staff. Strengthen monitoring, narrative alignment, and crisis drills while addressing the specific gaps flagged in this assessment. Periodic independent reviews of search and social channels will help detect drift early.",
  ],
  low: [
    "Reputational practices are strong overall, with minor enhancements available in monitoring, narrative stress-testing, or affiliate review. Close the isolated gaps identified below and sustain proactive reputation management as digital channels and media dynamics evolve.",
  ],
};

/** Liquidity & cash — mixed maturity by risk tier. */
export const LIQUIDITY_CASH_MID_BAND_NARRATIVES: PillarMidBandNarratives = {
  critical: [
    "Liquidity management lacks centralized visibility across accounts, entities, and planning horizons, creating material exposure to cash-flow disruption during market stress or capital calls. Establish a consolidated liquidity map, define minimum reserve thresholds, and align short-term instruments with obligation schedules. Coordinated planning with wealth and tax advisors should be prioritized to reduce forced-sale and timing risk.",
  ],
  high: [
    "Cash and liquidity practices address some near-term needs but lack consistency across the balance sheet and planning cycles. We recommend formalizing reserve policies, stress-testing liquidity under adverse scenarios, and integrating cash-flow projections with estate and investment planning. Closing the gaps identified below will improve resilience to unexpected capital demands.",
  ],
  medium: [
    "Liquidity management is moderately mature with identifiable strengths in reserve discipline alongside areas that need standardization. Focus on aligning reserve targets with obligation timelines, improving visibility into entity-level cash positions, and conducting periodic liquidity stress tests. Targeted improvements in the areas flagged below will strengthen cash-flow resilience.",
  ],
  low: [
    "Liquidity and cash management are well structured with only narrow gaps relative to best practice. Address the specific items noted in this assessment and maintain periodic stress-testing and reserve adequacy reviews as balance-sheet complexity and capital commitments evolve.",
  ],
};

/** Tax exposure — mixed maturity by risk tier. */
export const TAX_EXPOSURE_MID_BAND_NARRATIVES: PillarMidBandNarratives = {
  critical: [
    "Tax planning is fragmented across entities, jurisdictions, and advisory relationships, resulting in material exposure to inefficiency, penalties, and missed optimization opportunities. A comprehensive tax-risk assessment should map current obligations, identify structural misalignment, and establish coordinated compliance and planning workflows. Prioritize consolidating advisory oversight and documenting positions to reduce exposure to audit, recharacterization, and legislative change.",
  ],
  high: [
    "Tax practices address immediate compliance needs but lack integrated planning across entities, asset classes, and generational transfer strategies. We recommend benchmarking the current structure against peer families, stress-testing positions for legislative change, and formalizing coordination between tax counsel, estate planners, and investment advisors. Remediating the gaps below will reduce leakage and penalty risk.",
  ],
  medium: [
    "Tax management is moderately mature with effective compliance processes alongside opportunities to improve strategic coordination. Focus on the deficiencies identified in this assessment—particularly multi-entity optimization, estimated payment discipline, and documentation standards. Annual multi-advisor tax summits will help ensure planning keeps pace with balance-sheet and regulatory changes.",
  ],
  low: [
    "Tax planning and compliance are strong relative to peers, with minor enhancements available in documentation, scenario modeling, or cross-border coordination. Resolve the specific items flagged below and sustain proactive monitoring of legislative developments to protect the current structure.",
  ],
};

/** Estate & succession — mixed maturity by risk tier. */
export const ESTATE_SUCCESSION_MID_BAND_NARRATIVES: PillarMidBandNarratives = {
  critical: [
    "Estate and succession planning is incomplete or outdated across key documents, entity structures, and beneficiary designations, creating significant exposure to unintended outcomes and tax inefficiency. Immediate action should focus on updating core documents, aligning titling with estate intent, and establishing succession protocols for family governance and business interests. Coordinated advisor review is essential to close the most consequential gaps.",
  ],
  high: [
    "Estate documents and succession frameworks exist but show gaps in currency, coordination, or alignment with current family circumstances. We recommend a comprehensive document audit, beneficiary designation review, and formalization of succession plans for leadership roles, business interests, and philanthropic vehicles. Addressing the issues below will reduce probate risk and ensure intent is preserved.",
  ],
  medium: [
    "Estate and succession maturity is moderate, with core documents in place but refinements needed in coordination, contingency planning, or next-generation readiness. Prioritize the gaps identified in this assessment and schedule periodic reviews with estate counsel and wealth advisors to keep plans aligned with evolving family dynamics and regulatory changes.",
  ],
  low: [
    "Estate and succession planning is well established with only targeted updates needed. Address the specific items noted below and maintain regular reviews to ensure documents, structures, and designations remain current as family composition and tax law evolve.",
  ],
};

/** Family governance & behavioral — mixed maturity by risk tier. */
export const FAMILY_GOVERNANCE_BEHAVIORAL_MID_BAND_NARRATIVES: PillarMidBandNarratives = {
  critical: [
    "Family governance and behavioral alignment lack formal structure, leaving decision-making, conflict resolution, and next-generation engagement largely informal and person-dependent. Establish a written family governance charter, define decision rights and communication protocols, and create structured forums for intergenerational dialogue. Professional facilitation and education programs should be prioritized to build alignment and reduce interpersonal risk.",
  ],
  high: [
    "Governance norms and behavioral expectations are partially established but not consistently practiced across generations or family branches. We recommend formalizing meeting cadences, documenting shared values and decision frameworks, and implementing structured next-generation education. Closing the gaps below will reduce reliance on individual relationships and improve governance durability.",
  ],
  medium: [
    "Family governance and behavioral practices show moderate maturity with effective elements alongside areas that need formalization. Focus on strengthening conflict resolution mechanisms, documenting governance expectations, and expanding engagement opportunities for rising-generation members. Targeted improvements in the areas flagged below will reinforce family cohesion and governance resilience.",
  ],
  low: [
    "Family governance and behavioral alignment are strong overall, with minor opportunities to refine communication protocols, expand education programs, or update governance documents. Address the isolated gaps identified in this assessment and sustain regular family governance reviews to adapt practices as the family evolves.",
  ],
};

/** Mid-band narratives keyed by pillar slug and aggregate risk tier. */
export const PILLAR_MID_BAND_NARRATIVE_RECOMMENDATIONS: Record<
  string,
  PillarMidBandNarratives
> = {
  governance: GOVERNANCE_MID_BAND_NARRATIVES,
  "cyber-digital": CYBER_DIGITAL_MID_BAND_NARRATIVES,
  "physical-security": PHYSICAL_SECURITY_MID_BAND_NARRATIVES,
  insurance: INSURANCE_MID_BAND_NARRATIVES,
  "geographic-environmental": GEOGRAPHIC_ENVIRONMENTAL_MID_BAND_NARRATIVES,
  "reputational-social": REPUTATIONAL_SOCIAL_MID_BAND_NARRATIVES,
  "liquidity-cash": LIQUIDITY_CASH_MID_BAND_NARRATIVES,
  "tax-exposure": TAX_EXPOSURE_MID_BAND_NARRATIVES,
  "estate-succession": ESTATE_SUCCESSION_MID_BAND_NARRATIVES,
  "family-governance-behavioral": FAMILY_GOVERNANCE_BEHAVIORAL_MID_BAND_NARRATIVES,
};

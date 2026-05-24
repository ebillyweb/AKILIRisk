/**
 * Canonical pillar outcomes when every visible answer is at the lowest maturity.
 * Update when product copy or recommendation rules change.
 */

/** Reputational & social risk pillar narrative (all visible answers negative). */
export const REPUTATIONAL_SOCIAL_ALL_NEGATIVE_NARRATIVE_RECOMMENDATIONS = [
  "Client lacks process and practices for managing reputational risk, resulting in unmanaged exposure across search visibility, public narrative, social media activity, affiliations, and response readiness. We recommend a comprehensive digital footprint audit to identify, correct, or suppress inaccurate or outdated search results while establishing owned assets (e.g., personal website and controlled profiles) to shape top search outcomes. Conduct a reputational exposure review to identify potential spillover risks and align with intended public positioning. Develop crisis response protocols to ensure rapid, coordinated action in the event of reputational disruption.",
] as const;

/** Geographic / environmental pillar narrative (all visible answers negative). */
export const GEOGRAPHIC_ENVIRONMENTAL_ALL_NEGATIVE_NARRATIVE_RECOMMENDATIONS = [
  "Client lacks process and practices for identifying, mitigating, or managing geographic and environmental risk across property portfolio, creating exposure to both acute events and long-term climate and infrastructure stressors. We recommend establishing a portfolio-wide geographic risk mapping process that inventories all properties and evaluates exposure to natural hazards, extreme climate, and infrastructure fragility. Each property should undergo a formal risk assessment prior to acquisition or renewal, incorporating flood, wildfire, seismic, storm, and climate projection data.",
] as const;

/** Insurance pillar narrative (all visible answers negative). */
export const INSURANCE_ALL_NEGATIVE_NARRATIVE_RECOMMENDATIONS = [
  "Client lacks centralized oversight, coordination, and coverage alignment, creating material exposure across personal, business, and advisory activities. We recommend a comprehensive coverage audit to align policies with asset ownership structures, ensure appropriate liability limits (including umbrella/excess coverage), and address gaps across residences, vehicles, entities, and high-value assets. Consider tracking and documentation systems to manage renewals, claims history, and policy changes, alongside clear thresholds and processes for filing claims.",
] as const;

/** Physical security pillar narrative (all visible answers negative). */
export const PHYSICAL_SECURITY_ALL_NEGATIVE_NARRATIVE_RECOMMENDATIONS = [
  "Client lacks standard security and safety protocols across residences, travel, personnel access, or incident response, creating exposure to intrusion, personal safety threats, and situational risk escalation. We recommend establishing a centralized security oversight function responsible for coordinating residential, travel, and personal protection standards across all environments. Implement baseline residential security systems (alarms, cameras, controlled access) and conduct professional site security assessments for all properties. Consider introducing formal vetting and background screening for any staff and contractors involved in day-to-day household operations, along with structured visitor logging, access restrictions, and emergency response training. Develop travel security protocols and documented incident response and escalation protocols.",
] as const;

/** Cybersecurity pillar narrative (all visible answers negative). */
export const CYBER_DIGITAL_ALL_NEGATIVE_NARRATIVE_RECOMMENDATIONS = [
  "Client operates without a formal cybersecurity framework, creating elevated exposure across devices, accounts, financial systems, and personal data. We recommend cybersecurity education for all family members and staff. Deploy baseline protections such as password managers, multi-factor authentication, antivirus, and VPN tools. Enroll in a Digital Executive Protection program to provide continuous coverage across personal devices, accounts, and data, including home network surveillance, dark web monitoring, and identity protection. Develop an incident response plan covering fraud, device loss, and account compromise.",
] as const;

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

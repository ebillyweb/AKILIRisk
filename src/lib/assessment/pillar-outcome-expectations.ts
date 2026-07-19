/**
 * Canonical pillar outcome copy: extreme bands (all-no / all-yes) and mid-band
 * paragraphs for mixed maturity. Update when product copy or rules change.
 *
 * Mid-band copy lives in `pillar-outcome-expectations-mid-band.ts`.
 */

export {
  PILLAR_MID_BAND_NARRATIVE_RECOMMENDATIONS,
  GOVERNANCE_MID_BAND_NARRATIVES,
  type PillarMidBandRiskTier,
  type PillarMidBandNarratives,
} from "./pillar-outcome-expectations-mid-band";

/** Reputational & social risk pillar narrative (all visible answers at highest maturity). */
export const REPUTATIONAL_SOCIAL_ALL_YES_NARRATIVE_RECOMMENDATIONS = [
  "Client demonstrates strong visibility into their digital exposure. Recommend enhancements to anticipate how reputation evolves under external amplification and rapidly shifting information environments. Implement continuous narrative stress-testing, including simulated media scenarios and adversarial search reviews to identify how perception may shift under scrutiny. Further resilience can be strengthened through advanced monitoring tools that incorporate sentiment analysis and real-time media tracking. Periodic independent reputational audits can help validate that controlled narratives remain effective across search, social, and third-party channels.",
] as const;

/** Reputational & social risk pillar narrative (all visible answers negative). */
export const REPUTATIONAL_SOCIAL_ALL_NEGATIVE_NARRATIVE_RECOMMENDATIONS = [
  "Client lacks process and practices for managing reputational risk, resulting in unmanaged exposure across search visibility, public narrative, social media activity, affiliations, and response readiness. We recommend a comprehensive digital footprint audit to identify, correct, or suppress inaccurate or outdated search results while establishing owned assets (e.g., personal website and controlled profiles) to shape top search outcomes. Conduct a reputational exposure review to identify potential spillover risks and align with intended public positioning. Develop crisis response protocols to ensure rapid, coordinated action in the event of reputational disruption.",
] as const;

/** Geographic / environmental pillar narrative (all visible answers at highest maturity). */
export const GEOGRAPHIC_ENVIRONMENTAL_ALL_YES_NARRATIVE_RECOMMENDATIONS = [
  "Client demonstrates strong alignment across property exposure, environmental hazards, infrastructure resilience, and insurance integration. Further refinement can be achieved through cross-portfolio correlation analysis, assessing whether multiple properties are exposed to simultaneous disruption from the same regional or systemic event. Periodic independent resilience audits can help validate mitigation effectiveness and identify emerging gaps in infrastructure or emergency readiness. A disciplined annual re-underwriting of geographic exposure with advisors and insurers will ensure the framework remains adaptive as climate conditions, regulatory environments, and risk pricing continue to evolve.",
] as const;

/** Geographic / environmental pillar narrative (all visible answers negative). */
export const GEOGRAPHIC_ENVIRONMENTAL_ALL_NEGATIVE_NARRATIVE_RECOMMENDATIONS = [
  "Client lacks process and practices for identifying, mitigating, or managing geographic and environmental risk across property portfolio, creating exposure to both acute events and long-term climate and infrastructure stressors. We recommend establishing a portfolio-wide geographic risk mapping process that inventories all properties and evaluates exposure to natural hazards, extreme climate, and infrastructure fragility. Each property should undergo a formal risk assessment prior to acquisition or renewal, incorporating flood, wildfire, seismic, storm, and climate projection data.",
] as const;

/** Insurance pillar narrative (all visible answers at highest maturity). */
export const INSURANCE_ALL_YES_NARRATIVE_RECOMMENDATIONS = [
  "Client's insurance coverage is well-structured and demonstrates strong alignment across personal, business, and liability exposures, with effective governance and coordination in place. Recommend stress-testing coverage assumptions against low-probability, high-severity events to ensure limits and exclusions remain appropriate. Conduct periodic third-party policy benchmarking and independent coverage reviews to identify potential gaps relative to peer structures and evolving market conditions. Consider implementing scenario-based loss modeling (e.g., catastrophic liability, multi-asset loss events, or litigation exposure stacking) to validate adequacy of umbrella and excess layers.",
] as const;

/** Insurance pillar narrative (all visible answers negative). */
export const INSURANCE_ALL_NEGATIVE_NARRATIVE_RECOMMENDATIONS = [
  "Client lacks centralized oversight, coordination, and coverage alignment, creating material exposure across personal, business, and advisory activities. We recommend a comprehensive coverage audit to align policies with asset ownership structures, ensure appropriate liability limits (including umbrella/excess coverage), and address gaps across residences, vehicles, entities, and high-value assets. Consider tracking and documentation systems to manage renewals, claims history, and policy changes, alongside clear thresholds and processes for filing claims.",
] as const;

/** Physical security pillar narrative (all visible answers at highest maturity). */
export const PHYSICAL_SECURITY_ALL_YES_NARRATIVE_RECOMMENDATIONS = [
  "Client's physical security framework is well-developed, with appropriate controls across residences, travel practices, personnel access, and incident response planning. Consider enhancements that focus on anticipating adaptive threats and testing system performance under coordinated or multi-vector scenarios. We recommend conducting periodic independent security assessments and red-team style evaluations of residences and travel protocols to identify latent vulnerabilities. Further resilience can be strengthened through integrated threat intelligence monitoring, ensuring physical security decisions are informed by real-time risk conditions across regions and events.",
] as const;

/** Physical security pillar narrative (all visible answers negative). */
export const PHYSICAL_SECURITY_ALL_NEGATIVE_NARRATIVE_RECOMMENDATIONS = [
  "Client lacks standard security and safety protocols across residences, travel, personnel access, or incident response, creating exposure to intrusion, personal safety threats, and situational risk escalation. We recommend establishing a centralized security oversight function responsible for coordinating residential, travel, and personal protection standards across all environments. Implement baseline residential security systems (alarms, cameras, controlled access) and conduct professional site security assessments for all properties. Consider introducing formal vetting and background screening for any staff and contractors involved in day-to-day household operations, along with structured visitor logging, access restrictions, and emergency response training. Develop travel security protocols and documented incident response and escalation protocols.",
] as const;

/** Cybersecurity pillar narrative (all visible answers at highest maturity). */
export const CYBER_DIGITAL_ALL_YES_NARRATIVE_RECOMMENDATIONS = [
  "Client has implemented a comprehensive cybersecurity framework, reflecting a strong and disciplined approach to digital risk management. We recommend conducting periodic third-party security assessments and penetration testing to identify vulnerabilities that may not be visible internally. Incorporating advanced monitoring tools, such as real-time threat detection and behavioral analytics, can further strengthen early warning capabilities. Regular scenario-based simulations (e.g., phishing attacks, account takeovers, device compromise) will help validate response readiness and refine protocols.",
] as const;

/** Cybersecurity pillar narrative (all visible answers negative). */
export const CYBER_DIGITAL_ALL_NEGATIVE_NARRATIVE_RECOMMENDATIONS = [
  "Client operates without a formal cybersecurity framework, creating elevated exposure across devices, accounts, financial systems, and personal data. We recommend cybersecurity education for all family members and staff. Deploy baseline protections such as password managers, multi-factor authentication, antivirus, and VPN tools. Enroll in a Digital Executive Protection program to provide continuous coverage across personal devices, accounts, and data, including home network surveillance, dark web monitoring, and identity protection. Develop an incident response plan covering fraud, device loss, and account compromise.",
] as const;

/** Governance pillar narrative (all visible answers at highest maturity / “yes”). */
export const GOVERNANCE_ALL_YES_NARRATIVE_RECOMMENDATIONS = [
  "Client has established a strong, institutionalized governance framework, providing a solid foundation for effective decision-making and continuity. We recommend conducting periodic independent reviews to assess governance effectiveness and adherence to established policies. Implementing scenario planning and tabletop exercises will help stress-test the system across financial, reputational, and operational risks. Further refinement can be achieved through enhanced reporting, dashboards, and benchmarking against peer families and evolving best practices. Continued focus on next-generation readiness, advisor alignment, and crisis response capabilities will ensure the framework remains durable and adaptive over time.",
] as const;

/** Governance pillar narrative recommendations (all visible answers negative). */
export const GOVERNANCE_ALL_NEGATIVE_NARRATIVE_RECOMMENDATIONS = [
  "Engage an experienced estate planning attorney to establish a comprehensive estate plan to ensure assets are legally structured, titled, and transferred in alignment with the family's intent. This should include properly drafted wills, trusts, beneficiary designations, and coordinated planning across all entities and jurisdictions. Establish formal family governance structure to outline who has authority to make decisions, how leadership transitions occur, and how the family governs itself over time. This should include defined governance bodies (i.e. family council, family office, or investment committee), succession protocols, emergency decision authority, and next-generation preparedness.",
] as const;

/** Catalog services for governance-only lowest answers (Belvedere bank). */
export const GOVERNANCE_ALL_NEGATIVE_SERVICE_IDS = [
  "governance_family_charter",
  "governance_advisor_coordination",
  "governance_succession_planning",
] as const;

/**
 * Per-pillar catalog services triggered when only that pillar’s UI questions are
 * at lowest maturity (and only that pillar is scored).
 *
 * These now reflect the score-threshold-dominant rules: a weak pillar surfaces
 * all of its own remediation services, and the AI cross-links surface an AI
 * service for weak Cyber / Reputational posture. (Previously some sets were
 * shaped by cross-pillar `answer_match` quirks that never fired in production —
 * e.g. `insurance_estate_planning` fired on a governance question — now removed.)
 */
export const PILLAR_ALL_NEGATIVE_EXPECTED_SERVICE_IDS: Record<string, readonly string[]> = {
  governance: GOVERNANCE_ALL_NEGATIVE_SERVICE_IDS,
  "cyber-digital": ["cyber_security_uplift", "ai_impersonation_defense"],
  "physical-security": [
    "physical_security_assessment",
    "physical_security_implementation",
    "physical_emergency_planning",
  ],
  insurance: [
    "insurance_comprehensive_review",
    "insurance_estate_planning",
    "insurance_asset_protection",
  ],
  "geographic-environmental": [
    "geographic_risk_assessment",
    "geographic_climate_resilience",
    "geographic_diversification",
  ],
  "reputational-social": [
    "social_reputation_management",
    "social_media_governance",
    "social_crisis_response",
    "ai_synthetic_media_response",
  ],
  "ai-emerging-tech": [
    "ai_impersonation_defense",
    "ai_data_governance",
    "ai_synthetic_media_response",
    "ai_operations_oversight",
    "ai_household_literacy",
    "ai_risk_governance",
  ],
};

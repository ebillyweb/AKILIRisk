/**
 * Complete import of all 6 assessment pillars
 * Based on Belvedere risk assessment framework
 */

import { prisma, disconnectPrismaScript } from './lib/prisma-for-scripts';

// Governance Questions (Family decision-making and authority)
const GOVERNANCE_QUESTIONS = [
  {
    questionId: 'governance_decision_authority',
    text: 'Who has ultimate decision-making authority for family financial and strategic matters?',
    helpText: 'Clear decision-making authority reduces conflicts and ensures timely decisions during crises.',
    riskRelevance: 'Unclear authority creates decision paralysis during emergencies and can lead to family conflicts over important matters.',
    subCategory: 'decision_making',
    options: [
      { value: 'unclear_undefined', label: 'It\'s not clearly defined', description: 'No formal structure or unclear who has authority' },
      { value: 'consensus_required', label: 'All family members must agree', description: 'Unanimous consensus required for major decisions' },
      { value: 'patriarch_matriarch', label: 'Patriarch/Matriarch has sole authority', description: 'One family leader makes all major decisions' },
      { value: 'family_council', label: 'Family council or board', description: 'Formal group with defined membership and voting procedures' }
    ],
    scoreMap: { 'unclear_undefined': 0, 'consensus_required': 1, 'patriarch_matriarch': 2, 'family_council': 3 },
    weight: 3,
    remediationAction: 'Establish a clear family governance charter that defines decision-making authority, voting procedures, and escalation processes for different types of family decisions.'
  },
  {
    questionId: 'governance_family_charter',
    text: 'Do you have a written family charter or governance document?',
    riskRelevance: 'Family charters prevent conflicts by establishing shared values, expectations, and decision-making processes.',
    subCategory: 'documentation',
    options: [
      { value: 'none', label: 'None', description: 'No written governance documents' },
      { value: 'informal', label: 'Informal agreements', description: 'Verbal understandings or informal notes' },
      { value: 'basic_charter', label: 'Basic charter exists', description: 'Written document covering key governance areas' },
      { value: 'comprehensive_reviewed', label: 'Comprehensive and regularly reviewed', description: 'Detailed charter with regular updates and family input' }
    ],
    scoreMap: { 'none': 0, 'informal': 1, 'basic_charter': 2, 'comprehensive_reviewed': 3 },
    weight: 2
  },
  {
    questionId: 'governance_next_gen_engagement',
    text: 'How are next generation family members prepared for future governance roles?',
    riskRelevance: 'Unprepared next generation creates succession risks and governance continuity gaps.',
    subCategory: 'succession',
    options: [
      { value: 'no_preparation', label: 'No formal preparation', description: 'Next generation not involved in governance planning' },
      { value: 'informal_exposure', label: 'Informal exposure', description: 'Occasional inclusion in family discussions' },
      { value: 'structured_development', label: 'Structured development program', description: 'Formal education and mentoring programs' },
      { value: 'leadership_pipeline', label: 'Established leadership pipeline', description: 'Clear succession path with progressive responsibility' }
    ],
    scoreMap: { 'no_preparation': 0, 'informal_exposure': 1, 'structured_development': 2, 'leadership_pipeline': 3 },
    weight: 2
  },
  {
    questionId: 'governance_advisor_coordination',
    text: 'How well coordinated are your various advisors (legal, financial, tax, etc.)?',
    riskRelevance: 'Uncoordinated advisors can provide conflicting advice and miss important interdependencies.',
    subCategory: 'advisor_management',
    options: [
      { value: 'siloed', label: 'Siloed - advisors don\'t communicate', description: 'Advisors work independently without coordination' },
      { value: 'ad_hoc', label: 'Ad hoc communication', description: 'Occasional coordination on specific issues' },
      { value: 'regular_meetings', label: 'Regular advisor meetings', description: 'Scheduled coordination meetings with key advisors' },
      { value: 'integrated_team', label: 'Integrated advisory team', description: 'Formal team structure with clear communication protocols' }
    ],
    scoreMap: { 'siloed': 0, 'ad_hoc': 1, 'regular_meetings': 2, 'integrated_team': 3 },
    weight: 2
  },
  {
    questionId: 'governance_conflict_resolution',
    text: 'What processes exist for resolving family conflicts or disagreements?',
    riskRelevance: 'Family conflicts can escalate into legal disputes without proper resolution mechanisms.',
    subCategory: 'conflict_resolution',
    options: [
      { value: 'none', label: 'None - conflicts are avoided or ignored', description: 'No formal or informal conflict resolution process' },
      { value: 'informal', label: 'Informal family discussions', description: 'Ad hoc conversations to work through issues' },
      { value: 'mediation', label: 'Mediation or facilitated discussions', description: 'Use of neutral facilitators for complex issues' },
      { value: 'formal_process', label: 'Formal dispute resolution process', description: 'Documented escalation procedures and binding arbitration' }
    ],
    scoreMap: { 'none': 0, 'informal': 1, 'mediation': 2, 'formal_process': 3 },
    weight: 2
  },
  {
    questionId: 'governance_family_meetings',
    text: 'How often does the family hold formal governance meetings?',
    riskRelevance: 'Regular governance meetings ensure ongoing communication and coordinated decision-making.',
    subCategory: 'communication',
    options: [
      { value: 'never', label: 'Never', description: 'No regular family meetings for governance topics' },
      { value: 'crisis_only', label: 'Only during crises', description: 'Meetings only when problems arise' },
      { value: 'annual', label: 'Annual meetings', description: 'Once per year formal governance meetings' },
      { value: 'quarterly', label: 'Quarterly or more frequent', description: 'Regular scheduled governance meetings' }
    ],
    scoreMap: { 'never': 0, 'crisis_only': 1, 'annual': 2, 'quarterly': 3 },
    weight: 2
  }
];

// Physical Security Questions
const PHYSICAL_SECURITY_QUESTIONS = [
  {
    questionId: 'physical_home_security',
    text: 'What security measures are in place at your primary residence?',
    riskRelevance: 'Home security gaps create vulnerability to break-ins, theft, and personal safety threats.',
    subCategory: 'home_protection',
    options: [
      { value: 'basic_minimal', label: 'Basic/minimal (standard locks)', description: 'Standard residential security only' },
      { value: 'enhanced', label: 'Enhanced (alarm system, cameras)', description: 'Monitored alarm system and security cameras' },
      { value: 'comprehensive', label: 'Comprehensive security system', description: 'Professional security system with multiple layers' },
      { value: 'executive_protection', label: 'Executive protection level', description: 'High-end security with professional monitoring and response' }
    ],
    scoreMap: { 'basic_minimal': 0, 'enhanced': 1, 'comprehensive': 2, 'executive_protection': 3 },
    weight: 3
  },
  {
    questionId: 'physical_travel_security',
    text: 'What security protocols do you follow when traveling?',
    riskRelevance: 'Travel increases exposure to theft, kidnapping, and other personal safety risks.',
    subCategory: 'travel_safety',
    options: [
      { value: 'none', label: 'None - standard travel practices', description: 'No special security precautions when traveling' },
      { value: 'basic', label: 'Basic precautions', description: 'Limited security awareness and planning' },
      { value: 'planned', label: 'Planned security measures', description: 'Pre-travel security planning and protocols' },
      { value: 'professional', label: 'Professional security services', description: 'Use of professional security for travel' }
    ],
    scoreMap: { 'none': 0, 'basic': 1, 'planned': 2, 'professional': 3 },
    weight: 2
  },
  {
    questionId: 'physical_staff_vetting',
    text: 'How thoroughly are household staff and service providers vetted?',
    riskRelevance: 'Unvetted staff create insider threats and security vulnerabilities.',
    subCategory: 'personnel_security',
    options: [
      { value: 'none', label: 'None - basic hiring', description: 'Standard employment practices without security screening' },
      { value: 'basic', label: 'Basic background checks', description: 'Criminal background checks and references' },
      { value: 'enhanced', label: 'Enhanced screening', description: 'Comprehensive background investigation and security clearance' },
      { value: 'ongoing', label: 'Ongoing monitoring and re-screening', description: 'Periodic re-screening and security awareness training' }
    ],
    scoreMap: { 'none': 0, 'basic': 1, 'enhanced': 2, 'ongoing': 3 },
    weight: 2
  },
  {
    questionId: 'physical_emergency_plans',
    text: 'Do you have emergency response and evacuation plans?',
    riskRelevance: 'Emergency plans save lives and protect assets during natural disasters or security incidents.',
    subCategory: 'emergency_preparedness',
    options: [
      { value: 'none', label: 'None', description: 'No formal emergency plans or procedures' },
      { value: 'basic', label: 'Basic family emergency plan', description: 'Simple plan for common emergencies' },
      { value: 'comprehensive', label: 'Comprehensive emergency procedures', description: 'Detailed plans for multiple scenarios' },
      { value: 'tested', label: 'Tested and rehearsed plans', description: 'Regular drills and plan updates' }
    ],
    scoreMap: { 'none': 0, 'basic': 1, 'comprehensive': 2, 'tested': 3 },
    weight: 2
  },
  {
    questionId: 'physical_information_protection',
    text: 'How is sensitive physical information protected (documents, mail, etc.)?',
    riskRelevance: 'Physical information breaches can lead to identity theft and privacy violations.',
    subCategory: 'information_security',
    options: [
      { value: 'minimal', label: 'Minimal protection', description: 'Standard residential practices' },
      { value: 'secure_storage', label: 'Secure storage systems', description: 'Locked filing and secure document storage' },
      { value: 'controlled_access', label: 'Controlled access and handling', description: 'Restricted access and secure disposal procedures' },
      { value: 'professional_grade', label: 'Professional-grade security', description: 'Commercial-level document security and handling' }
    ],
    scoreMap: { 'minimal': 0, 'secure_storage': 1, 'controlled_access': 2, 'professional_grade': 3 },
    weight: 2
  }
];

// Insurance & Asset Protection Questions
const INSURANCE_QUESTIONS = [
  {
    questionId: 'insurance_coverage_review',
    text: 'How often do you review and update your insurance coverage?',
    riskRelevance: 'Outdated coverage creates gaps that can result in significant financial losses.',
    subCategory: 'coverage_management',
    options: [
      { value: 'never', label: 'Never or very rarely', description: 'Coverage set years ago without regular review' },
      { value: 'crisis_only', label: 'Only when claims occur', description: 'Review only triggered by incidents' },
      { value: 'periodic', label: 'Periodic reviews (every 3-5 years)', description: 'Regular but infrequent coverage review' },
      { value: 'annual', label: 'Annual comprehensive review', description: 'Systematic annual review of all coverage' }
    ],
    scoreMap: { 'never': 0, 'crisis_only': 1, 'periodic': 2, 'annual': 3 },
    weight: 3
  },
  {
    questionId: 'insurance_umbrella_coverage',
    text: 'Do you have adequate umbrella liability coverage?',
    riskRelevance: 'Inadequate liability coverage can expose personal assets to lawsuits and judgments.',
    subCategory: 'liability_protection',
    options: [
      { value: 'none', label: 'None or minimal', description: 'No umbrella coverage or very low limits' },
      { value: 'basic', label: 'Basic umbrella policy', description: 'Standard umbrella coverage in place' },
      { value: 'adequate', label: 'Coverage matches net worth', description: 'Umbrella limits appropriate for asset exposure' },
      { value: 'comprehensive', label: 'Comprehensive excess liability', description: 'Multiple layers with high limits and specialized coverage' }
    ],
    scoreMap: { 'none': 0, 'basic': 1, 'adequate': 2, 'comprehensive': 3 },
    weight: 3
  },
  {
    questionId: 'insurance_asset_titling',
    text: 'How are your assets titled for protection and succession purposes?',
    riskRelevance: 'Improper asset titling can create estate tax problems and creditor vulnerabilities.',
    subCategory: 'asset_protection',
    options: [
      { value: 'individual', label: 'Individual ownership', description: 'Assets held in individual names' },
      { value: 'joint_simple', label: 'Simple joint ownership', description: 'Basic joint ownership arrangements' },
      { value: 'trust_structures', label: 'Trust and entity structures', description: 'Assets held in trusts and protective entities' },
      { value: 'sophisticated', label: 'Sophisticated protection strategies', description: 'Advanced asset protection with multiple structures' }
    ],
    scoreMap: { 'individual': 0, 'joint_simple': 1, 'trust_structures': 2, 'sophisticated': 3 },
    weight: 2
  },
  {
    questionId: 'insurance_estate_planning',
    text: 'Is your estate planning current and comprehensive?',
    riskRelevance: 'Outdated estate plans can result in tax inefficiencies and family conflicts.',
    subCategory: 'estate_planning',
    options: [
      { value: 'none_outdated', label: 'None or significantly outdated', description: 'No estate plan or plan over 5+ years old' },
      { value: 'basic_current', label: 'Basic plan, relatively current', description: 'Simple will and basic planning documents' },
      { value: 'comprehensive', label: 'Comprehensive estate plan', description: 'Advanced planning with trusts and tax strategies' },
      { value: 'dynamic_updated', label: 'Dynamic plan with regular updates', description: 'Sophisticated plan with annual reviews and updates' }
    ],
    scoreMap: { 'none_outdated': 0, 'basic_current': 1, 'comprehensive': 2, 'dynamic_updated': 3 },
    weight: 3
  },
  {
    questionId: 'insurance_business_protection',
    text: 'If you own businesses, how are they protected from personal liability?',
    riskRelevance: 'Poor business protection can expose personal assets to business-related risks.',
    subCategory: 'business_protection',
    options: [
      { value: 'not_applicable', label: 'Not applicable - no business ownership', description: 'No business interests' },
      { value: 'minimal', label: 'Minimal protection', description: 'Basic corporate structure without comprehensive protection' },
      { value: 'standard', label: 'Standard business protection', description: 'Appropriate entity structure and business insurance' },
      { value: 'sophisticated', label: 'Sophisticated protection strategies', description: 'Advanced structures with comprehensive liability protection' }
    ],
    scoreMap: { 'not_applicable': 3, 'minimal': 0, 'standard': 2, 'sophisticated': 3 },
    weight: 2
  }
];

// Geographic Risk Questions
const GEOGRAPHIC_QUESTIONS = [
  {
    questionId: 'geographic_location_assessment',
    text: 'Have you assessed the specific risks of your primary residence location?',
    riskRelevance: 'Location-specific risks like natural disasters require targeted preparedness.',
    subCategory: 'location_risk',
    options: [
      { value: 'not_assessed', label: 'Not assessed', description: 'No formal assessment of location-specific risks' },
      { value: 'basic_awareness', label: 'Basic awareness', description: 'General awareness of local risks without formal assessment' },
      { value: 'professional_assessment', label: 'Professional risk assessment', description: 'Formal evaluation by security or risk professionals' },
      { value: 'comprehensive_ongoing', label: 'Comprehensive ongoing monitoring', description: 'Regular professional monitoring with updated assessments' }
    ],
    scoreMap: { 'not_assessed': 0, 'basic_awareness': 1, 'professional_assessment': 2, 'comprehensive_ongoing': 3 },
    weight: 2
  },
  {
    questionId: 'geographic_climate_preparedness',
    text: 'How prepared are you for climate-related risks in your area?',
    riskRelevance: 'Climate change increases frequency and severity of weather-related disasters.',
    subCategory: 'climate_risk',
    options: [
      { value: 'unprepared', label: 'Unprepared', description: 'No specific climate risk preparedness' },
      { value: 'basic', label: 'Basic preparedness', description: 'Standard emergency supplies and basic planning' },
      { value: 'comprehensive', label: 'Comprehensive preparedness', description: 'Detailed climate risk planning and resources' },
      { value: 'resilient_systems', label: 'Resilient systems in place', description: 'Advanced climate resilience with backup systems' }
    ],
    scoreMap: { 'unprepared': 0, 'basic': 1, 'comprehensive': 2, 'resilient_systems': 3 },
    weight: 2
  },
  {
    questionId: 'geographic_political_stability',
    text: 'Have you considered political and economic stability risks in your locations?',
    riskRelevance: 'Political instability can affect property rights, personal safety, and economic security.',
    subCategory: 'political_risk',
    options: [
      { value: 'not_considered', label: 'Not considered', description: 'No assessment of political/economic stability risks' },
      { value: 'basic_monitoring', label: 'Basic monitoring', description: 'General awareness through news and basic sources' },
      { value: 'professional_analysis', label: 'Professional risk analysis', description: 'Professional assessment of political and economic risks' },
      { value: 'dynamic_planning', label: 'Dynamic planning and contingencies', description: 'Active monitoring with contingency planning' }
    ],
    scoreMap: { 'not_considered': 0, 'basic_monitoring': 1, 'professional_analysis': 2, 'dynamic_planning': 3 },
    weight: 2
  },
  {
    questionId: 'geographic_regulatory_compliance',
    text: 'How well do you understand and comply with regulations across your jurisdictions?',
    riskRelevance: 'Multi-jurisdictional compliance failures can result in penalties and legal complications.',
    subCategory: 'regulatory_risk',
    options: [
      { value: 'limited', label: 'Limited understanding', description: 'Basic compliance without comprehensive understanding' },
      { value: 'adequate', label: 'Adequate compliance management', description: 'Good understanding with periodic professional advice' },
      { value: 'comprehensive', label: 'Comprehensive compliance program', description: 'Systematic compliance management across jurisdictions' },
      { value: 'expert_managed', label: 'Expert-managed compliance', description: 'Professional compliance management with ongoing monitoring' }
    ],
    scoreMap: { 'limited': 0, 'adequate': 1, 'comprehensive': 2, 'expert_managed': 3 },
    weight: 2
  },
  {
    questionId: 'geographic_diversification',
    text: 'How geographically diversified are your assets and residences?',
    riskRelevance: 'Geographic concentration increases vulnerability to local disasters and political risks.',
    subCategory: 'diversification',
    options: [
      { value: 'concentrated', label: 'Highly concentrated in one location', description: 'Most assets and time in single geographic area' },
      { value: 'limited', label: 'Limited diversification', description: 'Some geographic spread but still concentrated' },
      { value: 'moderate', label: 'Moderate diversification', description: 'Reasonable geographic spread of assets and time' },
      { value: 'well_diversified', label: 'Well diversified', description: 'Strategic geographic diversification with risk mitigation' }
    ],
    scoreMap: { 'concentrated': 0, 'limited': 1, 'moderate': 2, 'well_diversified': 3 },
    weight: 2
  }
];

// Reputational & Social Risk Questions
const SOCIAL_QUESTIONS = [
  {
    questionId: 'social_media_policies',
    text: 'Do you have family policies governing social media use and public sharing?',
    riskRelevance: 'Uncontrolled social media sharing can expose family information and create security risks.',
    subCategory: 'digital_reputation',
    options: [
      { value: 'none', label: 'None', description: 'No family guidelines or policies for social media use' },
      { value: 'informal', label: 'Informal guidelines', description: 'General family discussions about appropriate sharing' },
      { value: 'documented', label: 'Documented policies', description: 'Written social media guidelines and expectations' },
      { value: 'comprehensive', label: 'Comprehensive digital reputation management', description: 'Professional social media policies with monitoring' }
    ],
    scoreMap: { 'none': 0, 'informal': 1, 'documented': 2, 'comprehensive': 3 },
    weight: 2
  },
  {
    questionId: 'social_public_exposure',
    text: 'How carefully do you manage your family\'s public exposure and visibility?',
    riskRelevance: 'High public visibility increases security, privacy, and reputational risks.',
    subCategory: 'public_profile',
    options: [
      { value: 'unmanaged', label: 'Unmanaged public exposure', description: 'No consideration of public visibility implications' },
      { value: 'basic_awareness', label: 'Basic awareness and caution', description: 'General awareness with informal privacy practices' },
      { value: 'managed', label: 'Actively managed exposure', description: 'Deliberate management of public profile and visibility' },
      { value: 'professional', label: 'Professional reputation management', description: 'Professional PR and reputation management services' }
    ],
    scoreMap: { 'unmanaged': 0, 'basic_awareness': 1, 'managed': 2, 'professional': 3 },
    weight: 3
  },
  {
    questionId: 'social_family_conduct',
    text: 'Are there established standards for family member conduct and behavior?',
    riskRelevance: 'Clear conduct standards prevent reputational damage from family member actions.',
    subCategory: 'conduct_standards',
    options: [
      { value: 'none', label: 'No formal standards', description: 'No established expectations for family conduct' },
      { value: 'informal', label: 'Informal expectations', description: 'Unwritten understanding of appropriate behavior' },
      { value: 'documented', label: 'Documented standards', description: 'Written code of conduct or family values statement' },
      { value: 'enforced', label: 'Enforced with consequences', description: 'Clear standards with accountability mechanisms' }
    ],
    scoreMap: { 'none': 0, 'informal': 1, 'documented': 2, 'enforced': 3 },
    weight: 2
  },
  {
    questionId: 'social_crisis_communication',
    text: 'Do you have a plan for managing reputational crises or negative publicity?',
    riskRelevance: 'Reputational crises can escalate without proper communication strategies.',
    subCategory: 'crisis_management',
    options: [
      { value: 'none', label: 'No plan', description: 'No preparation for reputational crisis management' },
      { value: 'basic', label: 'Basic response plan', description: 'Simple plan for responding to negative publicity' },
      { value: 'comprehensive', label: 'Comprehensive crisis plan', description: 'Detailed crisis communication strategy and procedures' },
      { value: 'professional', label: 'Professional crisis management', description: 'Retained PR firm with crisis response capability' }
    ],
    scoreMap: { 'none': 0, 'basic': 1, 'comprehensive': 2, 'professional': 3 },
    weight: 2
  },
  {
    questionId: 'social_staff_confidentiality',
    text: 'How well trained are staff and service providers on confidentiality and discretion?',
    riskRelevance: 'Staff indiscretion can lead to privacy breaches and reputational damage.',
    subCategory: 'confidentiality',
    options: [
      { value: 'none', label: 'No training', description: 'No specific confidentiality training or agreements' },
      { value: 'basic', label: 'Basic confidentiality agreements', description: 'Standard NDAs without specific training' },
      { value: 'trained', label: 'Trained on confidentiality protocols', description: 'Regular training on privacy and confidentiality expectations' },
      { value: 'comprehensive', label: 'Comprehensive confidentiality program', description: 'Extensive training with ongoing monitoring and enforcement' }
    ],
    scoreMap: { 'none': 0, 'basic': 1, 'trained': 2, 'comprehensive': 3 },
    weight: 2
  }
];

async function importAllPillars() {
  throw new Error(
    "import-all-pillars (AssessmentBankQuestion) was removed. Run npm run seed:pillar-ddl instead.",
  );
  console.log('🏛️ Starting import of all assessment pillars...');

  const pillars = [
    {
      id: 'governance',
      name: 'Governance',
      questions: GOVERNANCE_QUESTIONS,
      subcategories: [
        { id: 'decision_making', name: 'Decision Making', description: 'Family authority and decision-making processes' },
        { id: 'documentation', name: 'Documentation', description: 'Governance documentation and policies' },
        { id: 'succession', name: 'Succession Planning', description: 'Next generation preparation and succession' },
        { id: 'advisor_management', name: 'Advisor Management', description: 'Coordination of professional advisors' },
        { id: 'conflict_resolution', name: 'Conflict Resolution', description: 'Family dispute resolution processes' },
        { id: 'communication', name: 'Communication', description: 'Family governance communication and meetings' }
      ]
    },
    {
      id: 'physical-security',
      name: 'Physical Security',
      questions: PHYSICAL_SECURITY_QUESTIONS,
      subcategories: [
        { id: 'home_protection', name: 'Home Protection', description: 'Residential security measures' },
        { id: 'travel_safety', name: 'Travel Safety', description: 'Security protocols for travel' },
        { id: 'personnel_security', name: 'Personnel Security', description: 'Staff vetting and security' },
        { id: 'emergency_preparedness', name: 'Emergency Preparedness', description: 'Emergency response and evacuation plans' },
        { id: 'information_security', name: 'Information Security', description: 'Physical information protection' }
      ]
    },
    {
      id: 'insurance',
      name: 'Insurance & Asset Protection',
      questions: INSURANCE_QUESTIONS,
      subcategories: [
        { id: 'coverage_management', name: 'Coverage Management', description: 'Insurance review and management' },
        { id: 'liability_protection', name: 'Liability Protection', description: 'Umbrella and liability coverage' },
        { id: 'asset_protection', name: 'Asset Protection', description: 'Asset titling and protection strategies' },
        { id: 'estate_planning', name: 'Estate Planning', description: 'Estate planning and succession' },
        { id: 'business_protection', name: 'Business Protection', description: 'Business liability protection' }
      ]
    },
    {
      id: 'geographic-environmental',
      name: 'Geographic Risk',
      questions: GEOGRAPHIC_QUESTIONS,
      subcategories: [
        { id: 'location_risk', name: 'Location Risk', description: 'Location-specific risk assessment' },
        { id: 'climate_risk', name: 'Climate Risk', description: 'Climate and weather-related preparedness' },
        { id: 'political_risk', name: 'Political Risk', description: 'Political and economic stability' },
        { id: 'regulatory_risk', name: 'Regulatory Risk', description: 'Multi-jurisdictional compliance' },
        { id: 'diversification', name: 'Diversification', description: 'Geographic diversification strategy' }
      ]
    },
    {
      id: 'reputational-social',
      name: 'Reputational & Social Risk',
      questions: SOCIAL_QUESTIONS,
      subcategories: [
        { id: 'digital_reputation', name: 'Digital Reputation', description: 'Social media and online presence management' },
        { id: 'public_profile', name: 'Public Profile', description: 'Public exposure and visibility management' },
        { id: 'conduct_standards', name: 'Conduct Standards', description: 'Family conduct expectations and standards' },
        { id: 'crisis_management', name: 'Crisis Management', description: 'Reputational crisis preparedness' },
        { id: 'confidentiality', name: 'Confidentiality', description: 'Staff and service provider discretion' }
      ]
    }
  ];

  await prisma.$transaction(async (tx) => {
    let totalQuestions = 0;

    for (const pillar of pillars) {
      console.log(`\n📋 Importing ${pillar.name} pillar...`);

      // Create pillar configuration
      await tx.pillarConfiguration.upsert({
        where: { pillarId: pillar.id },
        create: {
          pillarId: pillar.id,
          name: pillar.name,
          description: getDescriptionForPillar(pillar.id),
          baseWeight: 1.0,
          thresholds: getThresholdsForPillar(pillar.id),
          isActive: true
        },
        update: {
          name: pillar.name,
          description: getDescriptionForPillar(pillar.id),
          thresholds: getThresholdsForPillar(pillar.id)
        }
      });

      // Create subcategories
      for (let i = 0; i < pillar.subcategories.length; i++) {
        const subcat = pillar.subcategories[i];
        await tx.subCategoryConfiguration.upsert({
          where: { subcategoryId: subcat.id },
          create: {
            subcategoryId: subcat.id,
            pillarId: pillar.id,
            name: subcat.name,
            description: subcat.description,
            baseWeight: 1.0,
            sortOrder: i + 1,
            isActive: true
          },
          update: {
            name: subcat.name,
            description: subcat.description,
            sortOrder: i + 1
          }
        });
      }

      // Import questions
      for (let i = 0; i < pillar.questions.length; i++) {
        const question = pillar.questions[i];
        const helpText =
          "helpText" in question && question.helpText ? question.helpText : null;
        const learnMore =
          "remediationAction" in question && question.remediationAction
            ? question.remediationAction
            : null;

        await tx.assessmentBankQuestion.upsert({
          where: { questionId: question.questionId },
          create: {
            questionId: question.questionId,
            riskAreaId: pillar.id,
            sortOrderGlobal: (totalQuestions + i + 1),
            isVisible: true,
            text: question.text,
            helpText,
            learnMore,
            riskRelevance: question.riskRelevance || null,
            type: 'single-choice',
            options: question.options,
            required: true,
            weight: question.weight,
            scoreMap: question.scoreMap,
            branchingDependsOn: null,
            branchingPredicate: null,
            profileConditionKey: null,
            omitMaturityScoreWhenYes: false
          },
          update: {
            text: question.text,
            helpText,
            learnMore,
            riskRelevance: question.riskRelevance || null,
            options: question.options,
            weight: question.weight,
            scoreMap: question.scoreMap
          }
        });
      }

      totalQuestions += pillar.questions.length;
      console.log(`   ✅ Imported ${pillar.questions.length} questions for ${pillar.name}`);
    }

    console.log(`\n🎉 Successfully imported all pillars!`);
    console.log(`   📊 Total questions: ${totalQuestions}`);
    console.log(`   🏛️ Total pillars: ${pillars.length}`);

    return totalQuestions;
  });
}

function getDescriptionForPillar(pillarId: string): string {
  const descriptions = {
    'governance': 'Decision rights, family authority, advisor coordination, documentation, and dispute resolution.',
    'physical-security': 'Personal safety, property security, travel, and physical access control.',
    'insurance': 'Property, liability, and health continuity coverage; trusts, titling, succession, and concentration risk.',
    'geographic-environmental': 'Climate and location factors, regional hazards, regulatory context, and geography-driven exposure.',
    'reputational-social': 'Public footprint, conduct and social media norms, family standards, and reputation-sensitive behavior.'
  };
  return descriptions[pillarId as keyof typeof descriptions] || 'Risk assessment pillar';
}

function getThresholdsForPillar(pillarId: string) {
  // Using same thresholds as cybersecurity for consistency
  return {
    low: { min: 2.4, max: 3.0 },      // 80-100%
    medium: { min: 1.8, max: 2.37 },  // 60-79%
    high: { min: 1.2, max: 1.77 },    // 40-59%
    critical: { min: 0.0, max: 1.19 } // <40%
  };
}

async function main() {
  try {
    await importAllPillars();
    console.log('🎉 All pillars imported successfully!');
  } catch (error) {
    console.error('💥 Import failed:', error);
    process.exit(1);
  } finally {
    await disconnectPrismaScript();
  }
}

if (require.main === module) {
  main();
}

export { importAllPillars };
/**
 * Comprehensive risk question bank (`family-governance` pillar)
 *
 * Six pillars: Governance, Cyber security, Physical security, Insurance (incl. medical
 * continuity questions), Geographic, and Reputational & social risk.
 */

import { Question, Pillar } from './types';
import { ageFromBirthYear, hasMultipleGenerations, hasSuccessors, getMembersByRole } from './personalization';
import { cyberRiskQuestions } from '../cyber-risk/questions';

// ============================================================================
// ENVIRONMENTAL / GEOGRAPHIC RISK
// ============================================================================

const environmentalGeographicQuestions: Question[] = [
  {
    id: 'env-01',
    text: 'How well does your household understand exposure to regional hazards (flood zones, wildfire, hurricane, seismic, drought, or extreme heat) for primary residences?',
    helpText: 'Awareness drives insurance, mitigation, and evacuation planning.',
    type: 'maturity-scale',
    options: [
      { value: 0, label: 'Not discussed', description: 'No structured review' },
      { value: 1, label: 'Informal awareness', description: 'Ad-hoc conversations only' },
      { value: 2, label: 'Partially mapped', description: 'Some properties or risks assessed' },
      { value: 3, label: 'Documented & current', description: 'Hazards reviewed with updates' },
    ],
    required: true,
    pillar: 'family-governance',
    subCategory: 'geographic-environmental',
    weight: 4,
    scoreMap: { 0: 0, 1: 3, 2: 7, 3: 10 },
  },
  {
    id: 'env-02',
    text: 'Do you maintain practical plans for evacuation routes and emergency shelter relative to your main homes?',
    helpText: 'Coastal erosion, storms, and wildfire often require pre-planned exits.',
    type: 'single-choice',
    options: [
      { value: 'none', label: 'No plan' },
      { value: 'verbal', label: 'Informal family understanding only' },
      { value: 'written-partial', label: 'Partially written or outdated' },
      { value: 'written-current', label: 'Written, shared, and periodically reviewed' },
    ],
    required: true,
    pillar: 'family-governance',
    subCategory: 'geographic-environmental',
    weight: 4,
    scoreMap: { none: 0, verbal: 3, 'written-partial': 6, 'written-current': 10 },
  },
  {
    id: 'env-03',
    text: 'When choosing or keeping a primary property, how often do you factor proximity to appropriate emergency services (e.g. trauma-capable hospitals) and infrastructure resilience?',
    type: 'single-choice',
    options: [
      { value: 'never', label: 'Rarely or never a factor' },
      { value: 'sometimes', label: 'Sometimes considered' },
      { value: 'usually', label: 'Usually evaluated with advisors' },
      { value: 'always', label: 'Consistently documented criteria' },
    ],
    required: true,
    pillar: 'family-governance',
    subCategory: 'geographic-environmental',
    weight: 3,
    scoreMap: { never: 0, sometimes: 4, usually: 7, always: 10 },
  },
  {
    id: 'env-04',
    text: 'How current is property and catastrophe insurance (including flood and wind where relevant) relative to replacement value and hazard exposure?',
    type: 'maturity-scale',
    options: [
      { value: 0, label: 'Unknown or likely inadequate', description: 'No recent broker review' },
      { value: 1, label: 'Dated', description: 'Reviewed more than 2–3 years ago' },
      { value: 2, label: 'Recently reviewed', description: 'Aligned with most major assets' },
      { value: 3, label: 'Actively managed', description: 'Annual or triggered reviews with documentation' },
    ],
    required: true,
    pillar: 'family-governance',
    subCategory: 'geographic-environmental',
    weight: 4,
    scoreMap: { 0: 0, 1: 4, 2: 7, 3: 10 },
  },
  {
    id: 'env-05',
    text: 'Does the household have a defined continuity approach for prolonged outage or displacement (secondary location, key records, household communications)?',
    type: 'yes-no',
    options: [
      { value: 'yes', label: 'Yes, documented or rehearsed' },
      { value: 'no', label: 'No' },
    ],
    required: true,
    pillar: 'family-governance',
    subCategory: 'geographic-environmental',
    weight: 3,
    scoreMap: { yes: 10, no: 0 },
  },
];

// ============================================================================
// PHYSICAL SECURITY
// ============================================================================

const physicalSecurityQuestions: Question[] = [
  {
    id: 'phys-01',
    text: 'Overall, how would you rate physical security at primary residences (entry points, lighting, alarms, cameras, and staffing where used)?',
    type: 'maturity-scale',
    options: [
      { value: 0, label: 'Minimal', description: 'Little beyond locks' },
      { value: 1, label: 'Basic', description: 'Some measures, inconsistent use' },
      { value: 2, label: 'Solid', description: 'Layered measures for main homes' },
      { value: 3, label: 'Robust', description: 'Professionally assessed and maintained' },
    ],
    required: true,
    pillar: 'family-governance',
    subCategory: 'physical-security',
    weight: 4,
    scoreMap: { 0: 0, 1: 4, 2: 7, 3: 10 },
  },
  {
    id: 'phys-02',
    text: 'How actively does the household monitor neighborhood crime trends and adjust routines or physical measures?',
    type: 'single-choice',
    options: [
      { value: 'none', label: 'Not actively' },
      { value: 'informal', label: 'Informal news or neighbor chatter' },
      { value: 'periodic', label: 'Periodic review with security or local contacts' },
      { value: 'systematic', label: 'Systematic monitoring and documented adjustments' },
    ],
    required: true,
    pillar: 'family-governance',
    subCategory: 'physical-security',
    weight: 3,
    scoreMap: { none: 0, informal: 3, periodic: 7, systematic: 10 },
  },
  {
    id: 'phys-03',
    text: 'For high-risk travel (study abroad, business, or leisure in elevated-risk regions), what is the norm for security preparation?',
    type: 'single-choice',
    options: [
      { value: 'none', label: 'No standard process' },
      { value: 'ad-hoc', label: 'Handled case-by-case without a playbook' },
      { value: 'guided', label: 'Uses travel intelligence or provider briefings' },
      { value: 'formal', label: 'Written travel security playbook and checklists' },
    ],
    required: true,
    pillar: 'family-governance',
    subCategory: 'physical-security',
    weight: 4,
    scoreMap: { none: 0, 'ad-hoc': 4, guided: 7, formal: 10 },
  },
  {
    id: 'phys-04',
    text: 'Are dependents who spend extended time away (college, boarding school, gap year) briefed on physical safety and who to contact in an emergency?',
    type: 'yes-no',
    options: [
      { value: 'yes', label: 'Yes' },
      { value: 'no', label: 'No or inconsistent' },
    ],
    required: true,
    pillar: 'family-governance',
    subCategory: 'physical-security',
    weight: 3,
    scoreMap: { yes: 10, no: 0 },
    // Round-11 commit 2.2: age derived from birthYear at read time.
    profileCondition: (profile) =>
      profile.members.some((m) => {
        const age = ageFromBirthYear(m.birthYear);
        return age !== null && age < 26;
      }),
  },
  {
    id: 'phys-05',
    text: 'Does the household have a duress or emergency communication protocol if a member is under threat at home or in transit?',
    type: 'single-choice',
    options: [
      { value: 'none', label: 'None' },
      { value: 'informal', label: 'Informal family understanding' },
      { value: 'partial', label: 'Partially documented for some members' },
      { value: 'full', label: 'Documented, practiced, with clear escalation' },
    ],
    required: true,
    pillar: 'family-governance',
    subCategory: 'physical-security',
    weight: 4,
    scoreMap: { none: 0, informal: 3, partial: 6, full: 10 },
  },
];

// ============================================================================
// HEALTH & MEDICAL PREPAREDNESS
// ============================================================================

const healthMedicalQuestions: Question[] = [
  {
    id: 'health-01',
    text: 'How clear is your household’s medical emergency plan (who decides, preferred facilities, and how to reach key physicians)?',
    type: 'maturity-scale',
    options: [
      { value: 0, label: 'Unclear', description: 'No shared plan' },
      { value: 1, label: 'Partial', description: 'Known to some members only' },
      { value: 2, label: 'Mostly clear', description: 'Written or regularly discussed' },
      { value: 3, label: 'Robust', description: 'Documented, accessible, reviewed' },
    ],
    required: true,
    pillar: 'family-governance',
    subCategory: 'insurance',
    weight: 4,
    scoreMap: { 0: 0, 1: 3, 2: 7, 3: 10 },
  },
  {
    id: 'health-02',
    text: 'Are critical medications, allergies, and major diagnoses documented for caregivers and travel in a way the family can access quickly?',
    type: 'single-choice',
    options: [
      { value: 'none', label: 'Not centrally documented' },
      { value: 'scattered', label: 'Some info in different places' },
      { value: 'central', label: 'Central list, not always updated' },
      { value: 'current', label: 'Current, secure, and shared with key people' },
    ],
    required: true,
    pillar: 'family-governance',
    subCategory: 'insurance',
    weight: 4,
    scoreMap: { none: 0, scattered: 4, central: 7, current: 10 },
  },
  {
    id: 'health-03',
    text: 'For international travel, how do you handle medical coverage, evacuation, and point-of-care quality?',
    type: 'single-choice',
    options: [
      { value: 'none', label: 'No standard approach' },
      { value: 'ad-hoc', label: 'Insurance purchased trip-by-trip' },
      { value: 'solid', label: 'Consistent coverage and known contact numbers' },
      { value: 'robust', label: 'Evacuation/medical transport considered with providers' },
    ],
    required: true,
    pillar: 'family-governance',
    subCategory: 'insurance',
    weight: 4,
    scoreMap: { none: 0, 'ad-hoc': 4, solid: 7, robust: 10 },
  },
  {
    id: 'health-04',
    text: 'Has the household discussed how it would adjust to a major regional health threat (e.g. pandemic surge) affecting schools, travel, or elder care?',
    type: 'single-choice',
    options: [
      { value: 'never', label: 'Not meaningfully' },
      { value: 'once', label: 'Raised once, no lasting plan' },
      { value: 'light', label: 'Light playbook (supplies, comms, caregiving)' },
      { value: 'substantive', label: 'Substantive plan with assigned responsibilities' },
    ],
    required: true,
    pillar: 'family-governance',
    subCategory: 'insurance',
    weight: 3,
    scoreMap: { never: 0, once: 3, light: 7, substantive: 10 },
  },
  {
    id: 'health-05',
    text: 'For your primary homes, has the family identified an appropriate emergency department or trauma center for life-threatening events?',
    type: 'yes-no',
    options: [
      { value: 'yes', label: 'Yes' },
      { value: 'no', label: 'No' },
    ],
    required: true,
    pillar: 'family-governance',
    subCategory: 'insurance',
    weight: 3,
    scoreMap: { yes: 10, no: 0 },
  },
];

// ============================================================================
// GOVERNANCE (decision-making authority)
// ============================================================================

// ============================================================================
// SUB-CATEGORY: DECISION-MAKING AUTHORITY (8 questions)
// ============================================================================

const decisionMakingQuestions: Question[] = [
  {
    id: 'dma-01',
    text: 'Does your family have a formal governance structure (family council, board, or advisory committee)?',
    helpText: 'Formal structures provide clear accountability for family decisions.',
    learnMore: 'Family governance structures create defined roles, responsibilities, and decision-making processes. They help prevent conflicts by establishing who makes what decisions and how.',
    type: 'maturity-scale',
    options: [
      { value: 0, label: 'No formal structure', description: 'Decisions are informal' },
      { value: 1, label: 'Informal, case-by-case', description: 'Ad-hoc decision processes' },
      { value: 2, label: 'Documented but inconsistent', description: 'Structure exists but not always followed' },
      { value: 3, label: 'Formal, consistently applied', description: 'Defined structure with regular meetings' },
    ],
    required: true,
    pillar: 'family-governance',
    subCategory: 'governance',
    weight: 5,
    scoreMap: { 0: 0, 1: 3, 2: 6, 3: 10 },
  },
  {
    id: 'dma-02',
    text: 'How is board or council membership determined?',
    helpText: 'Clear selection criteria prevent favoritism and ensure qualified leadership.',
    type: 'single-choice',
    options: [
      { value: 'none', label: 'No formal board/council' },
      { value: 'informal', label: 'Informal selection by family elders' },
      { value: 'criteria-unclear', label: 'Selection process exists but criteria unclear' },
      { value: 'criteria-clear', label: 'Documented criteria (age, experience, etc.)' },
      { value: 'election', label: 'Democratic election process' },
    ],
    required: true,
    pillar: 'family-governance',
    subCategory: 'governance',
    weight: 3,
    scoreMap: { 'none': 0, 'informal': 2, 'criteria-unclear': 5, 'criteria-clear': 8, 'election': 10 },
    branchingRule: {
      dependsOn: 'dma-01',
      showIf: (answer) => answer !== 0,
    },
  },
  {
    id: 'dma-03',
    text: 'Are voting rights clearly defined and documented?',
    helpText: 'Ambiguous voting rights are a common source of family disputes.',
    type: 'yes-no',
    options: [
      { value: 'yes', label: 'Yes, documented and understood' },
      { value: 'no', label: 'No or unclear' },
    ],
    required: true,
    pillar: 'family-governance',
    subCategory: 'governance',
    weight: 4,
    scoreMap: { 'yes': 10, 'no': 0 },
  },
  {
    id: 'dma-04',
    text: 'Does your family have a documented conflict resolution process?',
    helpText: 'Pre-established processes reduce emotion and prevent escalation.',
    learnMore: 'Conflict resolution processes define steps for addressing disagreements (mediation, arbitration, voting). Having them in place before conflicts arise prevents disputes from escalating.',
    type: 'single-choice',
    options: [
      { value: 'none', label: 'No formal process' },
      { value: 'informal', label: 'Handled informally by family elders' },
      { value: 'documented', label: 'Documented process (internal mediation)' },
      { value: 'external', label: 'Includes external mediation or arbitration' },
    ],
    required: true,
    pillar: 'family-governance',
    subCategory: 'governance',
    weight: 5,
    scoreMap: { 'none': 0, 'informal': 3, 'documented': 7, 'external': 10 },
  },
  {
    id: 'dma-05',
    text: 'Are major decisions (asset sales, distributions, investments) documented with meeting minutes or written records?',
    helpText: 'Documentation protects against memory disputes and liability.',
    type: 'maturity-scale',
    options: [
      { value: 0, label: 'Rarely or never documented' },
      { value: 1, label: 'Documented occasionally' },
      { value: 2, label: 'Documented consistently but informally' },
      { value: 3, label: 'Formal minutes with signatures' },
    ],
    required: true,
    pillar: 'family-governance',
    subCategory: 'governance',
    weight: 4,
    scoreMap: { 0: 0, 1: 4, 2: 7, 3: 10 },
    textTemplate: (p) => {
      if (!p) return 'How does the primary decision maker communicate major financial decisions to the family?';
      const dm = getMembersByRole(p, 'DECISION_MAKER')[0];
      return dm
        ? `How does ${dm.displayLabel} communicate major financial decisions to the family?`
        : 'How does the primary decision maker communicate major financial decisions to the family?';
    },
  },
  {
    id: 'dma-06',
    text: 'Do decision-makers have defined terms or rotation schedules?',
    helpText: 'Term limits prevent power concentration and encourage leadership development.',
    type: 'yes-no',
    options: [
      { value: 'yes', label: 'Yes, defined terms or rotation' },
      { value: 'no', label: 'No, indefinite or lifetime roles' },
    ],
    required: false,
    pillar: 'family-governance',
    subCategory: 'governance',
    weight: 2,
    scoreMap: { 'yes': 10, 'no': 5 },
  },
  {
    id: 'dma-07',
    text: 'Are there clear thresholds for which decisions require unanimous vs. majority approval?',
    helpText: 'Defined thresholds speed decision-making and reduce bottlenecks.',
    type: 'single-choice',
    options: [
      { value: 'undefined', label: 'No clear thresholds' },
      { value: 'informal', label: 'Informal understanding' },
      { value: 'documented', label: 'Documented in governance policy' },
    ],
    required: true,
    pillar: 'family-governance',
    subCategory: 'governance',
    weight: 3,
    scoreMap: { 'undefined': 0, 'informal': 5, 'documented': 10 },
  },
  {
    id: 'dma-08',
    text: 'Do you have an independent advisor or outside board member for objective perspective?',
    helpText: 'External advisors reduce groupthink and bring professional expertise.',
    type: 'single-choice',
    options: [
      { value: 'none', label: 'No outside advisors' },
      { value: 'informal', label: 'Informal consultation with professionals' },
      { value: 'formal-advisor', label: 'Formal advisory role (non-voting)' },
      { value: 'formal-voting', label: 'Outside board member with voting rights' },
    ],
    required: false,
    pillar: 'family-governance',
    subCategory: 'governance',
    weight: 3,
    scoreMap: { 'none': 4, 'informal': 6, 'formal-advisor': 8, 'formal-voting': 10 },
  },
];

// ============================================================================
// SUB-CATEGORY 2: ACCESS CONTROLS (8 questions)
// ============================================================================

const accessControlQuestions: Question[] = [
  {
    id: 'ac-01',
    text: 'Who has access to detailed financial information (account balances, investment holdings, income)?',
    helpText: 'Unrestricted access creates privacy risks and potential for misuse.',
    type: 'single-choice',
    options: [
      { value: 'everyone', label: 'All family members' },
      { value: 'adults', label: 'Adult family members only' },
      { value: 'council', label: 'Family council/board members only' },
      { value: 'trustees', label: 'Trustees and fiduciaries only' },
      { value: 'need-to-know', label: 'Tiered access based on role' },
    ],
    required: true,
    pillar: 'family-governance',
    subCategory: 'cyber-digital',
    weight: 4,
    scoreMap: { 'everyone': 2, 'adults': 4, 'council': 7, 'trustees': 8, 'need-to-know': 10 },
  },
  {
    id: 'ac-02',
    text: 'Are access levels to financial accounts and systems formally defined?',
    helpText: 'Undefined access creates security vulnerabilities and fraud risk.',
    type: 'maturity-scale',
    options: [
      { value: 0, label: 'No formal access controls' },
      { value: 1, label: 'Informal, relationship-based access' },
      { value: 2, label: 'Documented access policies' },
      { value: 3, label: 'Role-based access with regular audits' },
    ],
    required: true,
    pillar: 'family-governance',
    subCategory: 'cyber-digital',
    weight: 5,
    scoreMap: { 0: 0, 1: 3, 2: 7, 3: 10 },
  },
  {
    id: 'ac-03',
    text: 'Do you require multi-factor authentication (MFA) for financial systems access?',
    helpText: 'MFA dramatically reduces unauthorized access risk.',
    type: 'yes-no',
    options: [
      { value: 'yes', label: 'Yes, required for all users' },
      { value: 'no', label: 'No or only for some users' },
    ],
    required: true,
    pillar: 'family-governance',
    subCategory: 'cyber-digital',
    weight: 4,
    scoreMap: { 'yes': 10, 'no': 0 },
  },
  {
    id: 'ac-04',
    text: 'How frequently are access permissions reviewed and updated?',
    helpText: 'Stale access permissions create security and privacy risks.',
    type: 'single-choice',
    options: [
      { value: 'never', label: 'Never or only when issues arise' },
      { value: 'ad-hoc', label: 'When roles change' },
      { value: 'annual', label: 'Annual review' },
      { value: 'quarterly', label: 'Quarterly or more frequent' },
    ],
    required: true,
    pillar: 'family-governance',
    subCategory: 'cyber-digital',
    weight: 3,
    scoreMap: { 'never': 0, 'ad-hoc': 4, 'annual': 7, 'quarterly': 10 },
  },
  {
    id: 'ac-05',
    text: 'Are passwords or credentials shared among family members?',
    helpText: 'Shared credentials eliminate accountability and increase breach risk.',
    type: 'single-choice',
    options: [
      { value: 'commonly', label: 'Yes, commonly shared' },
      { value: 'sometimes', label: 'Occasionally shared for convenience' },
      { value: 'rarely', label: 'Rarely, discouraged but not prohibited' },
      { value: 'never', label: 'Never, strictly prohibited' },
    ],
    required: true,
    pillar: 'family-governance',
    subCategory: 'cyber-digital',
    weight: 4,
    scoreMap: { 'commonly': 0, 'sometimes': 3, 'rarely': 6, 'never': 10 },
  },
  {
    id: 'ac-06',
    text: 'Do external advisors (accountants, lawyers, investment managers) have documented access policies?',
    helpText: 'Advisor access should be limited to what they need for their role.',
    type: 'single-choice',
    options: [
      { value: 'undefined', label: 'No formal policies' },
      { value: 'verbal', label: 'Verbal guidelines only' },
      { value: 'documented', label: 'Documented access agreements' },
      { value: 'audited', label: 'Documented and regularly audited' },
    ],
    required: true,
    pillar: 'family-governance',
    subCategory: 'cyber-digital',
    weight: 3,
    scoreMap: { 'undefined': 0, 'verbal': 4, 'documented': 7, 'audited': 10 },
  },
  {
    id: 'ac-07',
    text: 'Is there a process for immediately revoking access when someone leaves the family office or board?',
    helpText: 'Delayed revocation creates fraud and data breach risk.',
    type: 'yes-no',
    options: [
      { value: 'yes', label: 'Yes, immediate and documented' },
      { value: 'no', label: 'No or handled on case-by-case basis' },
    ],
    required: true,
    pillar: 'family-governance',
    subCategory: 'cyber-digital',
    weight: 4,
    scoreMap: { 'yes': 10, 'no': 0 },
  },
  {
    id: 'ac-08',
    text: 'Do you maintain audit logs of who accessed sensitive information and when?',
    helpText: 'Audit logs deter misuse and enable forensic investigation.',
    type: 'single-choice',
    options: [
      { value: 'none', label: 'No audit logging' },
      { value: 'system-default', label: 'System defaults (not reviewed)' },
      { value: 'logged-reviewed', label: 'Logged and periodically reviewed' },
      { value: 'monitored', label: 'Real-time monitoring and alerts' },
    ],
    required: false,
    pillar: 'family-governance',
    subCategory: 'cyber-digital',
    weight: 3,
    scoreMap: { 'none': 0, 'system-default': 4, 'logged-reviewed': 7, 'monitored': 10 },
  },
];

// ============================================================================
// SUB-CATEGORY 3: TRUST & ESTATE GOVERNANCE (10 questions)
// ============================================================================

const trustEstateQuestions: Question[] = [
  {
    id: 'teg-01',
    text: 'Does your family have trusts as part of the wealth structure?',
    helpText: 'Trusts are common estate planning tools for high-net-worth families.',
    type: 'yes-no',
    options: [
      { value: 'yes', label: 'Yes, one or more trusts' },
      { value: 'no', label: 'No trusts' },
    ],
    required: true,
    pillar: 'family-governance',
    subCategory: 'insurance',
    weight: 1,
    scoreMap: { 'yes': 5, 'no': 10 },
    omitMaturityScoreWhenYes: true,
  },
  {
    id: 'teg-02',
    text: 'Are trust documents centrally stored and accessible to relevant parties?',
    helpText: 'Lost or inaccessible trust documents create legal and tax complications.',
    type: 'single-choice',
    options: [
      { value: 'unknown', label: 'Location unknown or unclear' },
      { value: 'scattered', label: 'Multiple locations, no central repository' },
      { value: 'centralized', label: 'Centralized storage (attorney, family office)' },
      { value: 'digital-managed', label: 'Digital document management system' },
    ],
    required: true,
    pillar: 'family-governance',
    subCategory: 'insurance',
    weight: 4,
    scoreMap: { 'unknown': 0, 'scattered': 3, 'centralized': 7, 'digital-managed': 10 },
    branchingRule: {
      dependsOn: 'teg-01',
      showIf: (answer) => answer === 'yes',
    },
  },
  {
    id: 'teg-03',
    text: 'How were trustees selected?',
    helpText: 'Trustee selection affects trust administration quality and family dynamics.',
    type: 'single-choice',
    options: [
      { value: 'default', label: 'Default choice (family member, oldest child)' },
      { value: 'informal', label: 'Informal selection without clear criteria' },
      { value: 'criteria', label: 'Selected based on financial acumen, trustworthiness' },
      { value: 'professional', label: 'Professional trustee (bank, trust company)' },
    ],
    required: true,
    pillar: 'family-governance',
    subCategory: 'insurance',
    weight: 3,
    scoreMap: { 'default': 2, 'informal': 4, 'criteria': 8, 'professional': 10 },
    branchingRule: {
      dependsOn: 'teg-01',
      showIf: (answer) => answer === 'yes',
    },
    profileCondition: (p) => p.members.some(m => m.governanceRoles.includes('TRUSTEE')),
  },
  {
    id: 'teg-04',
    text: 'Are trustees held accountable through regular reporting or oversight?',
    helpText: 'Trustee oversight prevents mismanagement and self-dealing.',
    learnMore: 'Trust beneficiaries have legal rights to accountings and transparency. Regular reporting (annual statements, distribution policies) ensures trustees fulfill fiduciary duties.',
    type: 'maturity-scale',
    options: [
      { value: 0, label: 'No oversight or reporting' },
      { value: 1, label: 'Informal check-ins' },
      { value: 2, label: 'Annual written reports' },
      { value: 3, label: 'Formal oversight by trust committee or protector' },
    ],
    required: true,
    pillar: 'family-governance',
    subCategory: 'insurance',
    weight: 5,
    scoreMap: { 0: 0, 1: 3, 2: 7, 3: 10 },
    branchingRule: {
      dependsOn: 'teg-01',
      showIf: (answer) => answer === 'yes',
    },
  },
  {
    id: 'teg-05',
    text: 'How often do beneficiaries receive updates on trust assets and distributions?',
    helpText: 'Transparency reduces suspicion and conflict among beneficiaries.',
    type: 'single-choice',
    options: [
      { value: 'never', label: 'Never or only on request' },
      { value: 'ad-hoc', label: 'Ad-hoc, when distributions occur' },
      { value: 'annual', label: 'Annual statements' },
      { value: 'quarterly', label: 'Quarterly or more frequent' },
    ],
    required: true,
    pillar: 'family-governance',
    subCategory: 'insurance',
    weight: 3,
    scoreMap: { 'never': 0, 'ad-hoc': 4, 'annual': 7, 'quarterly': 10 },
    branchingRule: {
      dependsOn: 'teg-01',
      showIf: (answer) => answer === 'yes',
    },
  },
  {
    id: 'teg-06',
    text: 'When was the last time estate planning documents (wills, trusts) were reviewed?',
    helpText: 'Outdated estate plans fail to reflect tax law changes, family events, and asset changes.',
    type: 'single-choice',
    options: [
      { value: 'unknown', label: 'Unknown or over 10 years ago' },
      { value: '5-10-years', label: '5-10 years ago' },
      { value: '2-5-years', label: '2-5 years ago' },
      { value: 'recent', label: 'Within the last 2 years' },
    ],
    required: true,
    pillar: 'family-governance',
    subCategory: 'insurance',
    weight: 5,
    scoreMap: { 'unknown': 0, '5-10-years': 3, '2-5-years': 6, 'recent': 10 },
  },
  {
    id: 'teg-07',
    text: 'Is there a documented schedule for reviewing and updating estate plans?',
    helpText: 'Proactive reviews catch issues before they become problems.',
    type: 'single-choice',
    options: [
      { value: 'none', label: 'No schedule, reactive only' },
      { value: 'event-driven', label: 'Triggered by life events (births, deaths, marriages)' },
      { value: 'periodic', label: 'Regular schedule (every 3-5 years)' },
    ],
    required: true,
    pillar: 'family-governance',
    subCategory: 'insurance',
    weight: 3,
    scoreMap: { 'none': 2, 'event-driven': 6, 'periodic': 10 },
  },
  {
    id: 'teg-08',
    text: 'Are beneficiaries educated about their rights and responsibilities under the trust?',
    helpText: 'Beneficiary education reduces conflict and improves decision-making.',
    type: 'single-choice',
    options: [
      { value: 'none', label: 'No formal education' },
      { value: 'informal', label: 'Informal conversations' },
      { value: 'materials', label: 'Written materials provided' },
      { value: 'workshops', label: 'Workshops or formal training sessions' },
    ],
    required: false,
    pillar: 'family-governance',
    subCategory: 'insurance',
    weight: 2,
    scoreMap: { 'none': 3, 'informal': 5, 'materials': 7, 'workshops': 10 },
    branchingRule: {
      dependsOn: 'teg-01',
      showIf: (answer) => answer === 'yes',
    },
  },
  {
    id: 'teg-09',
    text: 'Do you have a trust protector or advisory committee with removal powers?',
    helpText: 'Protectors provide checks and balances against trustee misconduct.',
    learnMore: 'A trust protector is an independent party with authority to remove/replace trustees, modify terms, or resolve disputes. They act as a safeguard against trustee failure.',
    type: 'yes-no',
    options: [
      { value: 'yes', label: 'Yes, protector or committee defined' },
      { value: 'no', label: 'No protector role' },
    ],
    required: false,
    pillar: 'family-governance',
    subCategory: 'insurance',
    weight: 3,
    scoreMap: { 'yes': 10, 'no': 5 },
    branchingRule: {
      dependsOn: 'teg-01',
      showIf: (answer) => answer === 'yes',
    },
  },
  {
    id: 'teg-10',
    text: 'Are there provisions in the trust for dispute resolution among beneficiaries?',
    helpText: 'Built-in dispute mechanisms avoid costly litigation.',
    type: 'single-choice',
    options: [
      { value: 'none', label: 'No provisions' },
      { value: 'informal', label: 'Reliance on family communication' },
      { value: 'mediation', label: 'Mediation or arbitration clauses' },
    ],
    required: false,
    pillar: 'family-governance',
    subCategory: 'insurance',
    weight: 3,
    scoreMap: { 'none': 2, 'informal': 5, 'mediation': 10 },
    branchingRule: {
      dependsOn: 'teg-01',
      showIf: (answer) => answer === 'yes',
    },
  },
];

// ============================================================================
// SUB-CATEGORY 4: MARRIAGE & RELATIONSHIP RISK (8 questions)
// ============================================================================

const marriageRiskQuestions: Question[] = [
  {
    id: 'mrr-01',
    text: 'Are prenuptial or postnuptial agreements required for family members?',
    helpText: 'Prenups protect family assets in divorce and clarify asset ownership.',
    learnMore: 'Prenuptial agreements define separate vs. marital property, protecting family wealth from divorce claims. They should be reviewed by independent counsel for both parties.',
    type: 'single-choice',
    options: [
      { value: 'none', label: 'No policy or requirement' },
      { value: 'encouraged', label: 'Encouraged but not required' },
      { value: 'required', label: 'Required for access to family assets' },
      { value: 'required-enforced', label: 'Required and actively enforced' },
    ],
    required: true,
    pillar: 'family-governance',
    subCategory: 'insurance',
    weight: 5,
    scoreMap: { 'none': 0, 'encouraged': 4, 'required': 7, 'required-enforced': 10 },
  },
  {
    id: 'mrr-02',
    text: 'Are spouses or partners included in family governance discussions?',
    helpText: 'Inclusion reduces resentment; exclusion protects confidentiality.',
    type: 'single-choice',
    options: [
      { value: 'full-access', label: 'Full access to all governance matters' },
      { value: 'selective', label: 'Selective inclusion for some topics' },
      { value: 'blood-only', label: 'Blood family members only' },
      { value: 'tiered', label: 'Tiered access based on tenure or marriage duration' },
    ],
    required: true,
    pillar: 'family-governance',
    subCategory: 'insurance',
    weight: 3,
    scoreMap: { 'full-access': 4, 'selective': 7, 'blood-only': 6, 'tiered': 10 },
  },
  {
    id: 'mrr-03',
    text: 'Is there a documented policy on asset titling for married family members?',
    helpText: 'Unclear titling creates unintended marital property claims.',
    type: 'single-choice',
    options: [
      { value: 'none', label: 'No guidance' },
      { value: 'informal', label: 'Informal recommendations' },
      { value: 'documented', label: 'Documented policy (separate property guidance)' },
    ],
    required: true,
    pillar: 'family-governance',
    subCategory: 'insurance',
    weight: 4,
    scoreMap: { 'none': 0, 'informal': 5, 'documented': 10 },
  },
  {
    id: 'mrr-04',
    text: 'How is spousal involvement in family businesses handled?',
    helpText: 'Spouses working in family businesses complicate divorce scenarios.',
    type: 'single-choice',
    options: [
      { value: 'unrestricted', label: 'No restrictions' },
      { value: 'case-by-case', label: 'Evaluated case-by-case' },
      { value: 'policy', label: 'Clear policy (employment agreements, non-compete)' },
      { value: 'prohibited', label: 'Spouses generally not employed in family business' },
    ],
    required: true,
    pillar: 'family-governance',
    subCategory: 'insurance',
    weight: 3,
    scoreMap: { 'unrestricted': 2, 'case-by-case': 5, 'policy': 9, 'prohibited': 8 },
  },
  {
    id: 'mrr-05',
    text: 'Do you have a process for handling asset division if a family member divorces?',
    helpText: 'Pre-established divorce processes reduce conflict and legal costs.',
    type: 'maturity-scale',
    options: [
      { value: 0, label: 'No process, handled reactively' },
      { value: 1, label: 'Informal guidance from attorneys' },
      { value: 2, label: 'Documented policy for asset protection' },
      { value: 3, label: 'Comprehensive plan (buyout provisions, valuation formulas)' },
    ],
    required: true,
    pillar: 'family-governance',
    subCategory: 'insurance',
    weight: 4,
    scoreMap: { 0: 0, 1: 4, 2: 7, 3: 10 },
  },
  {
    id: 'mrr-06',
    text: 'Are partners introduced to family advisors (lawyers, wealth managers) to understand separate property?',
    helpText: 'Education reduces future disputes and shows good faith.',
    type: 'single-choice',
    options: [
      { value: 'no', label: 'No formal introductions' },
      { value: 'informal', label: 'Informal introductions' },
      { value: 'structured', label: 'Structured meetings to discuss asset structure' },
    ],
    required: false,
    pillar: 'family-governance',
    subCategory: 'insurance',
    weight: 2,
    scoreMap: { 'no': 5, 'informal': 7, 'structured': 10 },
  },
  {
    id: 'mrr-07',
    text: 'Is there a waiting period before spouses gain access to family wealth details?',
    helpText: 'Waiting periods reduce information exposure in early-stage marriages.',
    type: 'single-choice',
    options: [
      { value: 'immediate', label: 'Immediate access upon marriage' },
      { value: 'informal', label: 'Gradual, no formal policy' },
      { value: 'defined', label: 'Defined waiting period (e.g., 5 years)' },
    ],
    required: false,
    pillar: 'family-governance',
    subCategory: 'insurance',
    weight: 2,
    scoreMap: { 'immediate': 3, 'informal': 6, 'defined': 10 },
  },
  {
    id: 'mrr-08',
    text: 'Do you review and update prenuptial agreements periodically?',
    helpText: 'Prenups can become outdated as wealth and family circumstances change.',
    type: 'single-choice',
    options: [
      { value: 'no-prenups', label: 'No prenups in place' },
      { value: 'never', label: 'Prenups exist but never updated' },
      { value: 'event-driven', label: 'Updated after major events (child birth, asset change)' },
      { value: 'scheduled', label: 'Regular review schedule (every 5-10 years)' },
    ],
    required: false,
    pillar: 'family-governance',
    subCategory: 'insurance',
    weight: 2,
    scoreMap: { 'no-prenups': 0, 'never': 4, 'event-driven': 7, 'scheduled': 10 },
  },
];

// ============================================================================
// SUB-CATEGORY 5: SUCCESSION PLANNING (10 questions)
// ============================================================================

const successionPlanningQuestions: Question[] = [
  {
    id: 'sp-01',
    text: 'Does your family have children or other heirs?',
    helpText: 'Succession planning is critical if wealth will transfer to the next generation.',
    type: 'yes-no',
    options: [
      { value: 'yes', label: 'Yes' },
      { value: 'no', label: 'No' },
    ],
    required: true,
    pillar: 'family-governance',
    subCategory: 'insurance',
    weight: 1,
    scoreMap: { 'yes': 5, 'no': 10 },
    omitMaturityScoreWhenYes: true,
  },
  {
    id: 'sp-02',
    text: 'Is there a documented leadership succession plan for family governance roles?',
    helpText: 'Unplanned leadership transitions create power vacuums and conflict.',
    learnMore: 'Succession plans define who will take over governance roles (patriarch/matriarch, trustees, board seats) and how transitions occur. They prevent crisis-driven decision-making.',
    type: 'maturity-scale',
    options: [
      { value: 0, label: 'No succession plan' },
      { value: 1, label: 'Informal understanding or default heir' },
      { value: 2, label: 'Documented plan for key roles' },
      { value: 3, label: 'Comprehensive plan with training and transition timeline' },
    ],
    required: true,
    pillar: 'family-governance',
    subCategory: 'insurance',
    weight: 5,
    scoreMap: { 0: 0, 1: 3, 2: 7, 3: 10 },
    branchingRule: {
      dependsOn: 'sp-01',
      showIf: (answer) => answer === 'yes',
    },
    profileCondition: (p) => hasMultipleGenerations(p) || hasSuccessors(p),
    textTemplate: (p) => {
      if (!p) return 'How prepared is your primary successor for leadership responsibility?';
      const successor = getMembersByRole(p, 'SUCCESSOR')[0];
      return successor
        ? `How prepared is ${successor.displayLabel} for leadership responsibility?`
        : 'How prepared is your primary successor for leadership responsibility?';
    },
  },
  {
    id: 'sp-03',
    text: 'Are next-generation family members being actively prepared for wealth stewardship?',
    helpText: 'Unprepared heirs often squander wealth within one or two generations.',
    type: 'single-choice',
    options: [
      { value: 'none', label: 'No formal preparation' },
      { value: 'informal', label: 'Informal mentoring or conversations' },
      { value: 'training', label: 'Financial literacy training or family office exposure' },
      { value: 'structured', label: 'Structured development program with milestones' },
    ],
    required: true,
    pillar: 'family-governance',
    subCategory: 'insurance',
    weight: 4,
    scoreMap: { 'none': 0, 'informal': 4, 'training': 7, 'structured': 10 },
    branchingRule: {
      dependsOn: 'sp-01',
      showIf: (answer) => answer === 'yes',
    },
  },
  {
    id: 'sp-04',
    text: 'Are roles and responsibilities for family leadership positions clearly defined?',
    helpText: 'Ambiguous roles create confusion and succession conflicts.',
    type: 'single-choice',
    options: [
      { value: 'undefined', label: 'Roles are informal or undefined' },
      { value: 'general', label: 'General descriptions only' },
      { value: 'documented', label: 'Detailed role documentation' },
    ],
    required: true,
    pillar: 'family-governance',
    subCategory: 'insurance',
    weight: 3,
    scoreMap: { 'undefined': 0, 'general': 5, 'documented': 10 },
  },
  {
    id: 'sp-05',
    text: 'Do you have an emergency succession plan if key decision-makers become incapacitated?',
    helpText: 'Sudden incapacity without a plan creates family chaos and legal battles.',
    type: 'single-choice',
    options: [
      { value: 'none', label: 'No emergency plan' },
      { value: 'informal', label: 'Informal understanding' },
      { value: 'documented', label: 'Documented interim leadership plan' },
      { value: 'tested', label: 'Documented and tested/rehearsed' },
    ],
    required: true,
    pillar: 'family-governance',
    subCategory: 'insurance',
    weight: 5,
    scoreMap: { 'none': 0, 'informal': 3, 'documented': 7, 'tested': 10 },
  },
  {
    id: 'sp-06',
    text: 'How are successors identified for leadership roles?',
    helpText: 'Transparent selection criteria reduce resentment and perceived favoritism.',
    type: 'single-choice',
    options: [
      { value: 'default', label: 'Default by birth order or gender' },
      { value: 'informal', label: 'Chosen informally by current leaders' },
      { value: 'criteria', label: 'Based on documented criteria (competence, interest)' },
      { value: 'competitive', label: 'Competitive evaluation process' },
    ],
    required: true,
    pillar: 'family-governance',
    subCategory: 'insurance',
    weight: 4,
    scoreMap: { 'default': 2, 'informal': 4, 'criteria': 8, 'competitive': 10 },
    branchingRule: {
      dependsOn: 'sp-01',
      showIf: (answer) => answer === 'yes',
    },
  },
  {
    id: 'sp-07',
    text: 'Are next-generation members given opportunities to lead smaller initiatives before major roles?',
    helpText: 'Progressive responsibility builds competence and confidence.',
    type: 'yes-no',
    options: [
      { value: 'yes', label: 'Yes, gradual leadership development' },
      { value: 'no', label: 'No or direct transition to major roles' },
    ],
    required: false,
    pillar: 'family-governance',
    subCategory: 'insurance',
    weight: 2,
    scoreMap: { 'yes': 10, 'no': 4 },
    branchingRule: {
      dependsOn: 'sp-01',
      showIf: (answer) => answer === 'yes',
    },
  },
  {
    id: 'sp-08',
    text: 'Is there a mentorship program pairing senior and next-generation family members?',
    helpText: 'Mentorship transfers institutional knowledge and builds relationships.',
    type: 'single-choice',
    options: [
      { value: 'none', label: 'No formal mentorship' },
      { value: 'informal', label: 'Informal relationships' },
      { value: 'structured', label: 'Structured mentorship program' },
    ],
    required: false,
    pillar: 'family-governance',
    subCategory: 'insurance',
    weight: 2,
    scoreMap: { 'none': 5, 'informal': 7, 'structured': 10 },
    branchingRule: {
      dependsOn: 'sp-01',
      showIf: (answer) => answer === 'yes',
    },
  },
  {
    id: 'sp-09',
    text: 'How often is the succession plan reviewed and updated?',
    helpText: 'Succession plans become outdated as family and business circumstances change.',
    type: 'single-choice',
    options: [
      { value: 'never', label: 'Never or only in crisis' },
      { value: 'ad-hoc', label: 'When major events occur' },
      { value: 'periodic', label: 'Regular schedule (every 3-5 years)' },
    ],
    required: true,
    pillar: 'family-governance',
    subCategory: 'insurance',
    weight: 3,
    scoreMap: { 'never': 0, 'ad-hoc': 5, 'periodic': 10 },
  },
  {
    id: 'sp-10',
    text: 'Do you have a plan for transitioning wealth if no direct heirs are interested in leadership?',
    helpText: 'Disinterested heirs are common; alternatives should be pre-planned.',
    type: 'single-choice',
    options: [
      { value: 'none', label: 'No alternative plan' },
      { value: 'general', label: 'General ideas (sell, professional management)' },
      { value: 'documented', label: 'Documented alternatives (foundation, sale, liquidation)' },
    ],
    required: false,
    pillar: 'family-governance',
    subCategory: 'insurance',
    weight: 3,
    scoreMap: { 'none': 2, 'general': 6, 'documented': 10 },
    branchingRule: {
      dependsOn: 'sp-01',
      showIf: (answer) => answer === 'yes',
    },
  },
];

// ============================================================================
// REPUTATIONAL & SOCIAL RISK — BEHAVIOR STANDARDS (8 questions)
// ============================================================================

const behaviorStandardsQuestions: Question[] = [
  {
    id: 'bs-01',
    text: 'Does your family have a written family constitution, charter, or code of conduct?',
    helpText: 'Written standards clarify expectations and provide accountability mechanisms.',
    learnMore: 'Family constitutions articulate shared values, define behavioral expectations, and establish consequences for violations. They help preserve family culture across generations.',
    type: 'single-choice',
    options: [
      { value: 'none', label: 'No written standards' },
      { value: 'informal', label: 'Informal or verbal values' },
      { value: 'documented', label: 'Written family charter or constitution' },
      { value: 'enforced', label: 'Written and actively enforced' },
    ],
    required: true,
    pillar: 'family-governance',
    subCategory: 'reputational-social',
    weight: 4,
    scoreMap: { 'none': 0, 'informal': 4, 'documented': 7, 'enforced': 10 },
  },
  {
    id: 'bs-02',
    text: 'Are there defined consequences for violating family standards or policies?',
    helpText: 'Standards without enforcement lack credibility.',
    type: 'maturity-scale',
    options: [
      { value: 0, label: 'No defined consequences' },
      { value: 1, label: 'Informal social pressure' },
      { value: 2, label: 'Documented consequences (warnings, probation)' },
      { value: 3, label: 'Graduated enforcement (up to asset restriction)' },
    ],
    required: true,
    pillar: 'family-governance',
    subCategory: 'reputational-social',
    weight: 4,
    scoreMap: { 0: 0, 1: 3, 2: 6, 3: 10 },
  },
  {
    id: 'bs-03',
    text: 'Does your family have policies regarding substance abuse or addiction?',
    helpText: 'Addiction is a common wealth risk; policies enable early intervention.',
    type: 'single-choice',
    options: [
      { value: 'none', label: 'No formal policies' },
      { value: 'reactive', label: 'Handled reactively when issues arise' },
      { value: 'prevention', label: 'Prevention education and support resources' },
      { value: 'intervention', label: 'Formal intervention protocols and treatment requirements' },
    ],
    required: true,
    pillar: 'family-governance',
    subCategory: 'reputational-social',
    weight: 3,
    scoreMap: { 'none': 0, 'reactive': 4, 'prevention': 7, 'intervention': 10 },
  },
  {
    id: 'bs-04',
    text: 'Are there guidelines on public behavior and social media use?',
    helpText: 'Public mistakes can damage family reputation and create security risks.',
    type: 'single-choice',
    options: [
      { value: 'none', label: 'No guidelines' },
      { value: 'informal', label: 'Informal expectations' },
      { value: 'documented', label: 'Documented social media and public conduct policy' },
    ],
    required: true,
    pillar: 'family-governance',
    subCategory: 'reputational-social',
    weight: 3,
    scoreMap: { 'none': 2, 'informal': 6, 'documented': 10 },
  },
  {
    id: 'bs-05',
    text: 'How are disputes between family members typically handled?',
    helpText: 'Constructive dispute resolution preserves relationships and prevents escalation.',
    type: 'single-choice',
    options: [
      { value: 'avoided', label: 'Avoided or left to fester' },
      { value: 'informal', label: 'Informal mediation by family elders' },
      { value: 'facilitated', label: 'Facilitated discussions (family meetings)' },
      { value: 'professional', label: 'Professional mediation or counseling' },
    ],
    required: true,
    pillar: 'family-governance',
    subCategory: 'reputational-social',
    weight: 4,
    scoreMap: { 'avoided': 0, 'informal': 4, 'facilitated': 7, 'professional': 10 },
  },
  {
    id: 'bs-06',
    text: 'Does your family have a philanthropic mission or giving policy?',
    helpText: 'Structured philanthropy aligns family values and provides engagement opportunities.',
    type: 'single-choice',
    options: [
      { value: 'none', label: 'No formal philanthropy' },
      { value: 'ad-hoc', label: 'Ad-hoc charitable giving' },
      { value: 'mission', label: 'Defined philanthropic mission' },
      { value: 'structured', label: 'Structured foundation or DAF with family involvement' },
    ],
    required: false,
    pillar: 'family-governance',
    subCategory: 'reputational-social',
    weight: 2,
    scoreMap: { 'none': 5, 'ad-hoc': 6, 'mission': 8, 'structured': 10 },
  },
  {
    id: 'bs-07',
    text: 'Are family members expected to contribute to the family enterprise or office?',
    helpText: 'Clear contribution expectations prevent entitlement and resentment.',
    type: 'single-choice',
    options: [
      { value: 'none', label: 'No expectations' },
      { value: 'informal', label: 'Informal encouragement' },
      { value: 'defined', label: 'Defined contribution expectations (board service, advisory roles)' },
    ],
    required: false,
    pillar: 'family-governance',
    subCategory: 'reputational-social',
    weight: 2,
    scoreMap: { 'none': 5, 'informal': 7, 'defined': 10 },
  },
  {
    id: 'bs-08',
    text: 'How often are family standards and values formally discussed or reinforced?',
    helpText: 'Regular reinforcement keeps values alive across generations.',
    type: 'single-choice',
    options: [
      { value: 'never', label: 'Never or only in crisis' },
      { value: 'occasional', label: 'Occasionally at family events' },
      { value: 'annual', label: 'Annual family meetings or retreats' },
      { value: 'frequent', label: 'Frequent touchpoints and education' },
    ],
    required: false,
    pillar: 'family-governance',
    subCategory: 'reputational-social',
    weight: 3,
    scoreMap: { 'never': 2, 'occasional': 5, 'annual': 8, 'frequent': 10 },
  },
];

// ============================================================================
// SUB-CATEGORY 7: BUSINESS INVOLVEMENT (8 questions)
// ============================================================================

const businessInvolvementQuestions: Question[] = [
  {
    id: 'bi-01',
    text: 'Does your family own or operate a business?',
    helpText: 'Family business ownership introduces unique governance challenges.',
    type: 'yes-no',
    options: [
      { value: 'yes', label: 'Yes' },
      { value: 'no', label: 'No' },
    ],
    required: true,
    pillar: 'family-governance',
    subCategory: 'insurance',
    weight: 1,
    scoreMap: { 'yes': 5, 'no': 10 },
    omitMaturityScoreWhenYes: true,
  },
  {
    id: 'bi-02',
    text: 'Are there clear policies on which family members can work in the family business?',
    helpText: 'Undefined employment policies create nepotism and resentment.',
    learnMore: 'Family employment policies define qualifications (education, outside experience), hiring processes, compensation, and performance expectations for family employees.',
    type: 'single-choice',
    options: [
      { value: 'open', label: 'Open to any family member' },
      { value: 'informal', label: 'Informal criteria' },
      { value: 'documented', label: 'Documented qualification requirements' },
      { value: 'competitive', label: 'Competitive hiring process, same as non-family' },
    ],
    required: true,
    pillar: 'family-governance',
    subCategory: 'insurance',
    weight: 4,
    scoreMap: { 'open': 2, 'informal': 5, 'documented': 8, 'competitive': 10 },
    branchingRule: {
      dependsOn: 'bi-01',
      showIf: (answer) => answer === 'yes',
    },
  },
  {
    id: 'bi-03',
    text: 'Are family members in the business compensated at market rates?',
    helpText: 'Below-market or above-market compensation creates fairness issues.',
    type: 'single-choice',
    options: [
      { value: 'arbitrary', label: 'Arbitrary or relationship-based pay' },
      { value: 'informal', label: 'Loosely tied to market' },
      { value: 'market', label: 'Benchmarked to market rates' },
      { value: 'independent', label: 'Independently reviewed (compensation committee)' },
    ],
    required: true,
    pillar: 'family-governance',
    subCategory: 'insurance',
    weight: 3,
    scoreMap: { 'arbitrary': 0, 'informal': 4, 'market': 7, 'independent': 10 },
    branchingRule: {
      dependsOn: 'bi-01',
      showIf: (answer) => answer === 'yes',
    },
  },
  {
    id: 'bi-04',
    text: 'Are family employees subject to performance reviews like non-family employees?',
    helpText: 'Accountability prevents underperformance and maintains business credibility.',
    type: 'maturity-scale',
    options: [
      { value: 0, label: 'No performance reviews' },
      { value: 1, label: 'Informal feedback' },
      { value: 2, label: 'Formal reviews but handled gently' },
      { value: 3, label: 'Same rigorous standards as non-family' },
    ],
    required: true,
    pillar: 'family-governance',
    subCategory: 'insurance',
    weight: 4,
    scoreMap: { 0: 0, 1: 3, 2: 6, 3: 10 },
    branchingRule: {
      dependsOn: 'bi-01',
      showIf: (answer) => answer === 'yes',
    },
  },
  {
    id: 'bi-05',
    text: 'Does the family business have non-family professional management?',
    helpText: 'Outside management brings expertise and reduces family conflict.',
    type: 'single-choice',
    options: [
      { value: 'family-only', label: 'Family-only management' },
      { value: 'mixed', label: 'Mix of family and non-family managers' },
      { value: 'professional-led', label: 'Non-family CEO with family board oversight' },
    ],
    required: true,
    pillar: 'family-governance',
    subCategory: 'insurance',
    weight: 3,
    scoreMap: { 'family-only': 3, 'mixed': 7, 'professional-led': 10 },
    branchingRule: {
      dependsOn: 'bi-01',
      showIf: (answer) => answer === 'yes',
    },
  },
  {
    id: 'bi-06',
    text: 'Is there a process for removing underperforming family members from business roles?',
    helpText: 'Inability to remove family employees damages business performance.',
    type: 'single-choice',
    options: [
      { value: 'none', label: 'No removal process' },
      { value: 'informal', label: 'Informal, case-by-case' },
      { value: 'documented', label: 'Documented process with clear triggers' },
    ],
    required: true,
    pillar: 'family-governance',
    subCategory: 'insurance',
    weight: 4,
    scoreMap: { 'none': 0, 'informal': 4, 'documented': 10 },
    branchingRule: {
      dependsOn: 'bi-01',
      showIf: (answer) => answer === 'yes',
    },
  },
  {
    id: 'bi-07',
    text: 'Are ownership and management roles clearly separated?',
    helpText: 'Conflating ownership and management creates governance confusion.',
    type: 'single-choice',
    options: [
      { value: 'merged', label: 'Owners manage the business directly' },
      { value: 'partial', label: 'Some separation but overlapping roles' },
      { value: 'clear', label: 'Clear separation with defined board oversight' },
    ],
    required: true,
    pillar: 'family-governance',
    subCategory: 'insurance',
    weight: 4,
    scoreMap: { 'merged': 2, 'partial': 6, 'clear': 10 },
    branchingRule: {
      dependsOn: 'bi-01',
      showIf: (answer) => answer === 'yes',
    },
  },
  {
    id: 'bi-08',
    text: 'Is there a documented plan for transferring business ownership across generations?',
    helpText: 'Ownership transitions are complex; planning prevents disputes and tax penalties.',
    type: 'maturity-scale',
    options: [
      { value: 0, label: 'No transition plan' },
      { value: 1, label: 'General intentions but not documented' },
      { value: 2, label: 'Documented plan (estate or succession planning)' },
      { value: 3, label: 'Comprehensive plan with tax optimization and phased transfer' },
    ],
    required: true,
    pillar: 'family-governance',
    subCategory: 'insurance',
    weight: 5,
    scoreMap: { 0: 0, 1: 3, 2: 6, 3: 10 },
    branchingRule: {
      dependsOn: 'bi-01',
      showIf: (answer) => answer === 'yes',
    },
  },
];

// ============================================================================
// SUB-CATEGORY 8: DOCUMENTATION & COMMUNICATION (8 questions)
// ============================================================================

const documentationCommunicationQuestions: Question[] = [
  {
    id: 'dc-01',
    text: 'How often does your family hold formal meetings to discuss governance and financial matters?',
    helpText: 'Regular meetings maintain alignment and surface issues early.',
    type: 'single-choice',
    options: [
      { value: 'never', label: 'Never or only in crisis' },
      { value: 'ad-hoc', label: 'Ad-hoc when needed' },
      { value: 'annual', label: 'Annual family meetings' },
      { value: 'quarterly', label: 'Quarterly or more frequent' },
    ],
    required: true,
    pillar: 'family-governance',
    subCategory: 'governance',
    weight: 4,
    scoreMap: { 'never': 0, 'ad-hoc': 4, 'annual': 7, 'quarterly': 10 },
  },
  {
    id: 'dc-02',
    text: 'Are family meeting agendas planned in advance?',
    helpText: 'Planned agendas keep meetings productive and on-topic.',
    type: 'yes-no',
    options: [
      { value: 'yes', label: 'Yes, agenda distributed in advance' },
      { value: 'no', label: 'No, informal or spontaneous' },
    ],
    required: true,
    pillar: 'family-governance',
    subCategory: 'governance',
    weight: 2,
    scoreMap: { 'yes': 10, 'no': 4 },
  },
  {
    id: 'dc-03',
    text: 'Are meeting minutes recorded and stored?',
    helpText: 'Minutes provide accountability and historical record.',
    type: 'maturity-scale',
    options: [
      { value: 0, label: 'No minutes taken' },
      { value: 1, label: 'Informal notes' },
      { value: 2, label: 'Formal minutes distributed to attendees' },
      { value: 3, label: 'Formal minutes with centralized storage' },
    ],
    required: true,
    pillar: 'family-governance',
    subCategory: 'governance',
    weight: 3,
    scoreMap: { 0: 0, 1: 4, 2: 7, 3: 10 },
  },
  {
    id: 'dc-04',
    text: 'Where are critical family documents stored (wills, trusts, governance policies)?',
    helpText: 'Disorganized documents create delays, legal costs, and lost opportunities.',
    type: 'single-choice',
    options: [
      { value: 'scattered', label: 'Scattered across individuals' },
      { value: 'attorney', label: 'With attorney or advisor' },
      { value: 'centralized', label: 'Centralized physical storage (safe, office)' },
      { value: 'digital', label: 'Secure digital repository with access controls' },
    ],
    required: true,
    pillar: 'family-governance',
    subCategory: 'governance',
    weight: 4,
    scoreMap: { 'scattered': 0, 'attorney': 5, 'centralized': 7, 'digital': 10 },
  },
  {
    id: 'dc-05',
    text: 'Who has access to the document repository?',
    helpText: 'Access should be need-based and auditable.',
    type: 'single-choice',
    options: [
      { value: 'unclear', label: 'Unclear or unrestricted' },
      { value: 'informal', label: 'Key family members informally' },
      { value: 'defined', label: 'Defined by role (trustees, advisors, etc.)' },
    ],
    required: true,
    pillar: 'family-governance',
    subCategory: 'governance',
    weight: 3,
    scoreMap: { 'unclear': 2, 'informal': 6, 'defined': 10 },
  },
  {
    id: 'dc-06',
    text: 'Are family advisors (lawyers, accountants, wealth managers) coordinated or siloed?',
    helpText: 'Siloed advisors create gaps, inconsistencies, and higher costs.',
    learnMore: 'Coordinated advisor teams ensure estate plans align with tax strategies, investments align with liquidity needs, and everyone has a complete picture.',
    type: 'single-choice',
    options: [
      { value: 'siloed', label: 'Each advisor works independently' },
      { value: 'informal', label: 'Informal coordination' },
      { value: 'formal', label: 'Formal coordination (quarterly meetings, shared documentation)' },
    ],
    required: true,
    pillar: 'family-governance',
    subCategory: 'governance',
    weight: 4,
    scoreMap: { 'siloed': 2, 'informal': 6, 'formal': 10 },
  },
  {
    id: 'dc-07',
    text: 'Is there a documented process for resolving disputes or addressing grievances?',
    helpText: 'Clear processes prevent escalation and preserve relationships.',
    type: 'single-choice',
    options: [
      { value: 'none', label: 'No formal process' },
      { value: 'informal', label: 'Informal mediation by family members' },
      { value: 'documented', label: 'Documented escalation path (mediation, arbitration)' },
    ],
    required: true,
    pillar: 'family-governance',
    subCategory: 'governance',
    weight: 4,
    scoreMap: { 'none': 0, 'informal': 5, 'documented': 10 },
  },
  {
    id: 'dc-08',
    text: 'Does your family have a privacy policy regarding discussions about wealth with outsiders?',
    helpText: 'Uncontrolled information sharing creates security and reputational risks.',
    type: 'single-choice',
    options: [
      { value: 'none', label: 'No policy' },
      { value: 'informal', label: 'Informal expectations' },
      { value: 'documented', label: 'Documented confidentiality policy' },
    ],
    required: true,
    pillar: 'family-governance',
    subCategory: 'governance',
    weight: 3,
    scoreMap: { 'none': 2, 'informal': 6, 'documented': 10 },
  },
];

// ============================================================================
// PILLAR DEFINITION
// ============================================================================

export const familyGovernancePillar: Pillar = {
  id: 'family-governance',
  name: 'Comprehensive Risk Assessment',
  slug: 'family-governance',
  description:
    'Governance, cyber security, physical security, insurance (structures and medical continuity), geographic exposure, and reputational & social risk.',
  estimatedMinutes: 32,
  subCategories: [
    {
      id: 'governance',
      name: 'Governance',
      description:
        'Decision rights, family councils, documentation, meetings, advisor coordination, and dispute resolution.',
      weight: 11,
      questionIds: [
        ...decisionMakingQuestions.map((q) => q.id),
        ...documentationCommunicationQuestions.map((q) => q.id),
      ],
    },
    {
      id: 'cyber-digital',
      name: 'Cyber security',
      description:
        'Home and device security, digital hygiene, identity protection, banking and payment safety, plus access controls for sensitive information.',
      weight: 20,
      questionIds: [
        ...accessControlQuestions.map((q) => q.id),
        ...cyberRiskQuestions.map((q) => q.id),
      ],
    },
    {
      id: 'physical-security',
      name: 'Physical security',
      description:
        'Residence hardening, neighborhood exposure, travel and dependent safety, and duress protocols.',
      weight: 13,
      questionIds: physicalSecurityQuestions.map((q) => q.id),
    },
    {
      id: 'insurance',
      name: 'Insurance',
      description:
        'Coverage and liability, trusts and estates, marriage and titling, succession, business involvement, medical continuity, and concentration context.',
      weight: 34,
      questionIds: [
        ...trustEstateQuestions.map((q) => q.id),
        ...marriageRiskQuestions.map((q) => q.id),
        ...successionPlanningQuestions.map((q) => q.id),
        ...businessInvolvementQuestions.map((q) => q.id),
        ...healthMedicalQuestions.map((q) => q.id),
      ],
    },
    {
      id: 'geographic-environmental',
      name: 'Geographic',
      description:
        'Natural hazards, property and catastrophe coverage, evacuation planning, and proximity to emergency infrastructure.',
      weight: 12,
      questionIds: environmentalGeographicQuestions.map((q) => q.id),
    },
    {
      id: 'reputational-social',
      name: 'Reputational & social risk',
      description:
        'Family standards, conduct, substance policies, public and social media norms, and reputation-sensitive behavior.',
      weight: 10,
      questionIds: behaviorStandardsQuestions.map((q) => q.id),
    },
  ],
};

// ============================================================================
// AGGREGATE EXPORTS
// ============================================================================

export const allQuestions: Question[] = [
  ...environmentalGeographicQuestions,
  ...physicalSecurityQuestions,
  ...healthMedicalQuestions,
  ...decisionMakingQuestions,
  ...accessControlQuestions,
  ...cyberRiskQuestions,
  ...trustEstateQuestions,
  ...marriageRiskQuestions,
  ...successionPlanningQuestions,
  ...behaviorStandardsQuestions,
  ...businessInvolvementQuestions,
  ...documentationCommunicationQuestions,
];

export function getQuestionsBySubCategory(subCategoryId: string): Question[] {
  return allQuestions.filter(q => q.subCategory === subCategoryId);
}

export function getQuestion(questionId: string): Question | undefined {
  return allQuestions.find(q => q.id === questionId);
}

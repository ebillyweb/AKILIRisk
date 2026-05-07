export type TemplateId =
  | 'governance'
  | 'cyber-digital'
  | 'physical-security'
  | 'insurance'
  | 'geographic-environmental'
  | 'reputational-social';

export interface TemplateMetadata {
  id: TemplateId;
  name: string;
  description: string;
  category: string;
  applicableSubCategories: string[];
}

export interface TemplateData {
  familyName: string;
  assessmentDate: string;
  overallScore: number;
  riskLevel: string;
  categoryScore: number;
  categoryRiskLevel: string;
  gaps: Array<{
    description: string;
    severity: string;
    recommendation: string;
  }>;
  strengths: string[];
  recommendations: string[];

  // Household member data (empty arrays/strings when no profile).
  // Round-11 commit 2.2 (BRD §5.1 amendment): templates surface
  // auto-assigned `displayLabel` ("Member A", "Member B"…) instead of
  // personal names, because the HouseholdMember row no longer carries
  // a name. The role-joined strings (decisionMakers / successors /
  // trustees / …) are now joined labels rather than joined names.
  householdMembers?: Array<{
    displayLabel: string;
    relationship: string;
    governanceRoles: string[];
  }>;
  decisionMakers?: string; // Display labels of members with DECISION_MAKER role (comma-joined)
  successors?: string; // Display labels of members with SUCCESSOR role (comma-joined)
  trustees?: string; // Display labels of members with TRUSTEE role (comma-joined)
  advisors?: string; // Display labels of members with ADVISOR role (comma-joined)
  beneficiaries?: string; // Display labels of members with BENEFICIARY role (comma-joined)
  executors?: string; // Display labels of members with EXECUTOR role (comma-joined)
  householdHead?: string; // Display label of primary decision maker or first member
}

export const TEMPLATE_REGISTRY: TemplateMetadata[] = [
  {
    id: 'governance',
    name: 'Governance Policy',
    description: 'Decision rights, meetings, documentation, and advisor coordination',
    category: 'governance',
    applicableSubCategories: ['governance'],
  },
  {
    id: 'cyber-digital',
    name: 'Cyber security & digital access policy',
    description: 'Authentication, device hygiene, and sensitive information access',
    category: 'cyber-digital',
    applicableSubCategories: ['cyber-digital'],
  },
  {
    id: 'physical-security',
    name: 'Physical security policy',
    description: 'Residence security, travel safety, and duress protocols',
    category: 'physical-security',
    applicableSubCategories: ['physical-security'],
  },
  {
    id: 'insurance',
    name: 'Insurance & asset protection policy',
    description: 'Coverage, trusts, titling, succession, medical continuity, and concentration',
    category: 'insurance',
    applicableSubCategories: ['insurance'],
  },
  {
    id: 'geographic-environmental',
    name: 'Geographic risk policy',
    description: 'Hazards, catastrophe insurance, evacuation, and continuity',
    category: 'geographic-environmental',
    applicableSubCategories: ['geographic-environmental'],
  },
  {
    id: 'reputational-social',
    name: 'Reputational & social risk policy',
    description: 'Conduct standards, visibility, social media, and reputation-sensitive behavior',
    category: 'reputational-social',
    applicableSubCategories: ['reputational-social'],
  },
];

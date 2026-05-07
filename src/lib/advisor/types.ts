import type { IntakeApproval, IntakeInterview, IntakeResponse } from '@prisma/client';
import type { AdvisorHouseholdMemberView } from '@/lib/profiles/advisor-household-view';

// Dashboard client data for advisor's client list.
// Round-11 commit 2.1 (BRD §5.1 amendment): clientProfile contact +
// address fields are gone. The advisor card now shows name + email
// only; per-client phone/location was the primary consumer of the
// dropped fields.
export type AdvisorDashboardClient = {
  id: string;
  name: string | null;
  email: string;
  assignedAt: Date;
  latestInterview: {
    id: string;
    status: string;
    submittedAt: Date | null;
    responseCount: number;
  } | null;
};

// Complete data for reviewing a client's intake interview
export type IntakeReviewData = {
  interview: IntakeInterview & {
    user: {
      id: string;
      name: string | null;
      email: string;
    };
    responses: IntakeResponse[];
  };
  approval: IntakeApproval | null;
  questions: IntakeQuestion[];
  /** Household directory mapped for advisor visibility (name/contact redacted per client preference). */
  householdMembers: AdvisorHouseholdMemberView[];
};

export type IntakeQuestion = {
  id: string;
  text: string;
  helpText?: string;
  learnMore?: string;
  type: string;
  options?: Array<{ value: number; label: string; description?: string }>;
  /** Full intake form fields for advisor view: same as client sees, enables "Play question" TTS */
  questionNumber?: number;
  questionText?: string;
  context?: string;
  /** Pillar rubric “why this matters”; for tooltip only, not inline copy. */
  whyThisMatters?: string;
  recordingTips?: string[];
};

// Risk area selection for advisor approval process
export type RiskAreaSelection = {
  subCategoryId: string;
  subCategoryName: string;
  selected: boolean;
};

// Risk areas: six pillars for comprehensive assessment.
// F2 / BRD §4.1 — the six IDs match BRD-domain wording. Migration
// 20260521120000 renamed the four drifted IDs in the DB; the code-side
// rename here keeps the source of truth in sync. Unchanged: governance,
// physical-security. Renamed (old → new):
//   cybersecurity                  → cyber-digital
//   financial-asset-protection     → insurance
//   environmental-geographic-risk  → geographic-environmental
//   lifestyle-behavioral-risk      → reputational-social
export const RISK_AREAS = [
  {
    id: 'governance',
    name: 'Governance',
    summary:
      'Decision rights, family authority, advisor coordination, documentation, and dispute resolution.',
  },
  {
    id: 'cyber-digital',
    name: 'Cyber security',
    summary: 'Digital footprint, data protection, fraud, and online threats.',
  },
  {
    id: 'physical-security',
    name: 'Physical security',
    summary: 'Personal safety, property security, travel, and physical access control.',
  },
  {
    id: 'insurance',
    name: 'Insurance',
    summary:
      'Property, liability, and health continuity coverage; trusts, titling, succession, and concentration risk.',
  },
  {
    id: 'geographic-environmental',
    name: 'Geographic',
    summary:
      'Climate and location factors, regional hazards, regulatory context, and geography-driven exposure.',
  },
  {
    id: 'reputational-social',
    name: 'Reputational & social risk',
    summary:
      'Public footprint, conduct and social media norms, family standards, and reputation-sensitive behavior.',
  },
] as const;
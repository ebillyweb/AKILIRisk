import type { IntakeApproval, IntakeInterview, IntakeResponse } from '@prisma/client';
import type { PillarRecommendation } from '@/lib/intake/pillar-recommendations';
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

/** US-46c: per-advisor advisory note view shape. Filtered server-side to
 *  the calling advisor's own note (the DB row can carry one note per
 *  assigned advisor). */
export type AdvisorIntakeResponseNoteView = {
  id: string;
  body: string;
  updatedAt: string;
};

/** Payload returned by intake review data loaders before script personalization. */
export type IntakeInterviewReviewBundle = {
  interview: IntakeInterview & {
    user: {
      id: string;
      name: string | null;
      email: string;
    };
    responses: Array<
      IntakeResponse & { advisorNote: AdvisorIntakeResponseNoteView | null }
    >;
  };
  approval: IntakeApproval | null;
  /** Assigning advisor profile — used for approvals and PII policy under firm-wide access. */
  assignmentAdvisorProfileId?: string;
};

import type { AssessmentDomainOption } from "@/lib/advisor/assessment-domain-option";

// Complete data for reviewing a client's intake interview
export type IntakeReviewData = {
  interview: IntakeInterviewReviewBundle["interview"];
  approval: IntakeApproval | null;
  questions: IntakeQuestion[];
  /** Intake-driven pillar suggestions for the approval sidebar (US-70). */
  pillarRecommendations: PillarRecommendation[];
  /** Household directory mapped for advisor visibility (name/contact redacted per client preference). */
  householdMembers: AdvisorHouseholdMemberView[];
  /** Active methodology pillars for domain pickers (from DB). */
  assessmentDomains: AssessmentDomainOption[];
  assignmentAdvisorProfileId: string;
};

export type IntakeQuestion = {
  id: string;
  text: string;
  helpText?: string;
  learnMore?: string;
  type: string;
  options?: Array<{ value: number; label: string; description?: string }>;
  /** Full intake form fields for advisor read-only review */
  questionNumber?: number;
  questionText?: string;
  context?: string;
  /** Pillar rubric “why this matters”; staff review only. */
  whyThisMatters?: string;
  /** Pillar recommended actions; staff review / report queue only. */
  recommendedActions?: string;
  recordingTips?: string[];
};

// Risk area selection for advisor approval process
export type RiskAreaSelection = {
  subCategoryId: string;
  subCategoryName: string;
  selected: boolean;
};

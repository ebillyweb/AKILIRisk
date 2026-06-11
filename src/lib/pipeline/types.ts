import {
  AssignmentStatus,
  ClientWorkflowStage,
  InvitationStatus,
  type DeliverablePhase,
} from '@prisma/client';

// Re-export for convenience
export { ClientWorkflowStage } from '@prisma/client';

// Single client in the pipeline view
export type PipelineClient = {
  id: string;              // User.id
  name: string | null;
  email: string;
  assignedAt: Date;
  stage: ClientWorkflowStage;
  progress: number;        // 0-100 percentage
  lastActivity: Date;      // Most recent status change
  /** No activity for more than 7 days and not Complete (US-28) */
  stalled: boolean;
  /** Submitted intake pending advisor approval (Epic 5.2 / US-29) */
  awaitingIntakeReview: boolean;
  /** When awaitingIntakeReview, link target for /advisor/review/[id] */
  intakeReviewInterviewId: string | null;
  /** Mandatory document requirements still open */
  documentsNeeded: boolean;
  /** Completed assessment answers changed since last re-score */
  needsRescore: boolean;
  // Invitation data (if exists)
  invitation: {
    status: InvitationStatus;
    sentAt: Date;
    code: string;
  } | null;
  // Intake data (if exists)
  intake: {
    status: string;
    responseCount: number;
    submittedAt: Date | null;
    /** Set when advisor waived intake requirement for this assignment */
    waivedAt: Date | null;
  } | null;
  // Assessment data (if exists)
  assessment: {
    status: string;
    completedAt: Date | null;
    score: number | null;
    version: number | null;
    answersChangedAfterCompleteAt: Date | null;
  } | null;
  // Document tracking
  documents: {
    required: number;
    fulfilled: number;
  };
};

// Summary metrics for the pipeline dashboard
export type PipelineMetrics = {
  total: number;
  byStage: Record<ClientWorkflowStage, number>;
  documentsNeeded: number;  // clients with unfulfilled mandatory document requirements
  needsRescore: number;     // completed assessments with post-completion answer edits
  stalled: number;          // clients with no activity in 7+ days
  intakesAwaitingReview: number; // submitted intake not yet approved/rejected
  /** Ended workflows (INACTIVE assignments) for this advisor */
  inactive: number;
};

// Filter options for pipeline table
export type PipelineFilters = {
  stage?: ClientWorkflowStage;
  /** When true, only clients flagged as stalled */
  stalled?: boolean;
  /** When true, only clients with intake pending advisor approval */
  awaitingIntakeReview?: boolean;
  /** When true, only clients with unfulfilled mandatory documents */
  documentsNeeded?: boolean;
  /** When true, only clients whose completed assessment answers changed */
  needsRescore?: boolean;
  /** When true, list inactive (ended) client workflows instead of active ones */
  inactive?: boolean;
  search?: string;
  sortBy?: 'name' | 'stage' | 'progress' | 'lastActivity';
  sortDir?: 'asc' | 'desc';
};

// Client detail data for drill-down view
export type ClientDetail = {
  client: PipelineClient;
  timeline: WorkflowEvent[];
  documentRequirements: {
    id: string;
    name: string;
    description: string | null;
    required: boolean;
    fulfilled: boolean;
    fulfilledAt: Date | null;
    createdAt: Date;
    fileName: string | null;
    fileSize: number | null;
  }[];
  intakeDetails: {
    interviewId: string;
    status: string;
    responseCount: number;
    totalQuestions: number;
    submittedAt: Date | null;
  } | null;
  advisorAssignment: {
    id: string;
    status: AssignmentStatus;
    intakeWaivedAt: Date | null;
    includedPillars: string[];
    focusAreas: string[];
  };
  assessmentDetails: {
    /** §4.5 commit 2: needed by the per-client view to build a
     *  `/api/reports/[id]/pdf` URL for the advisor's "Download client
     *  report" button. Populated from `latestAssessment.id` in the
     *  pipeline query. */
    id: string;
    status: string;
    score: number | null;
    riskLevel: string | null;
    completedAt: Date | null;
    version: number;
    answersChangedAfterCompleteAt: Date | null;
    deliverablePhase: DeliverablePhase;
    pillarScores: { pillar: string; score: number; riskLevel: string }[];
  } | null;
};

// Timeline event for workflow progression
export type WorkflowEvent = {
  stage: ClientWorkflowStage;
  label: string;
  date: Date;
  detail?: string;
};
import { ClientWorkflowStage, InvitationStatus } from '@prisma/client';

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
  documentsNeeded: number;  // clients with unfulfilled document requirements
  stalled: number;          // clients with no activity in 7+ days
};

// Filter options for pipeline table
export type PipelineFilters = {
  stage?: ClientWorkflowStage;
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
    intakeWaivedAt: Date | null;
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
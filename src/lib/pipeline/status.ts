import { ClientWorkflowStage, InvitationStatus, IntakeStatus, AssessmentStatus } from '@prisma/client';
import type { DeliverablePhase } from '@prisma/client';
import { isDeliverableProfilePublished } from '@/lib/assessment/plan-depth';

interface ClientRawData {
  invitation?: {
    status: InvitationStatus;
    statusUpdatedAt: Date;
  };
  intake?: {
    status: IntakeStatus;
    updatedAt: Date;
    /** When set, intake is finished even if `status` was not updated to SUBMITTED. */
    submittedAt?: Date | null;
    /** Advisor waived intake; treat as past intake for stage when no assessment yet. */
    waived?: boolean;
  };
  assessment?: {
    status: AssessmentStatus;
    completedAt?: Date | null;
    updatedAt: Date;
    /** When PREVIEW, assessment is scored but Risk Profile is not published yet. */
    deliverablePhase?: DeliverablePhase | null;
  };
  /** Mandatory (`required: true`) document counts for stage gating */
  documents?: {
    required: number;
    fulfilled: number;
  };
}

/**
 * Determines the appropriate ClientWorkflowStage based on raw client data
 */
export function computeClientStage(data: ClientRawData): ClientWorkflowStage {
  const { invitation, intake, assessment, documents } = data;

  // Priority: later stages override earlier ones (assessment > intake > invitation)

  // Check assessment status first (highest priority)
  if (assessment) {
    if (assessment.status === 'COMPLETED') {
      // Scored but not yet published → stay on assessment complete, not report.
      if (!isDeliverableProfilePublished(assessment.deliverablePhase ?? 'PREVIEW')) {
        return 'ASSESSMENT_COMPLETE';
      }
      if (documents && documents.required > 0) {
        return documents.fulfilled < documents.required
          ? 'DOCUMENTS_REQUIRED'
          : 'COMPLETE';
      }
      // Profile published and no mandatory documents outstanding
      return 'COMPLETE';
    }
    if (assessment.status === 'IN_PROGRESS') {
      return 'ASSESSMENT_IN_PROGRESS';
    }
  }

  // Check intake status (medium priority)
  if (intake) {
    if (intake.waived) {
      return 'INTAKE_COMPLETE';
    }
    if (
      intake.submittedAt != null ||
      intake.status === 'COMPLETED' ||
      intake.status === 'SUBMITTED'
    ) {
      return 'INTAKE_COMPLETE';
    }
    if (intake.status === 'IN_PROGRESS') {
      return 'INTAKE_IN_PROGRESS';
    }
  }

  // Check invitation status (lowest priority)
  if (invitation) {
    if (invitation.status === 'SENT' || invitation.status === 'OPENED') {
      return 'INVITED';
    }
    if (invitation.status === 'REGISTERED') {
      return 'REGISTERED';
    }
  }

  // Default: if no invitation but has assignment, they were assigned directly
  return 'REGISTERED';
}

/**
 * Maps workflow stage to progress percentage
 */
export function computeProgress(stage: ClientWorkflowStage): number {
  const progressMap: Record<ClientWorkflowStage, number> = {
    INVITED: 10,
    REGISTERED: 20,
    INTAKE_IN_PROGRESS: 35,
    INTAKE_COMPLETE: 50,
    ASSESSMENT_IN_PROGRESS: 65,
    ASSESSMENT_COMPLETE: 80,
    DOCUMENTS_REQUIRED: 85,
    COMPLETE: 100,
  };

  return progressMap[stage];
}

const PIPELINE_PROCESS_LABEL: Record<ClientWorkflowStage, string> = {
  INVITED: 'intake',
  REGISTERED: 'intake',
  INTAKE_IN_PROGRESS: 'intake',
  INTAKE_COMPLETE: 'intake',
  ASSESSMENT_IN_PROGRESS: 'assessment',
  ASSESSMENT_COMPLETE: 'assessment',
  DOCUMENTS_REQUIRED: 'report',
  COMPLETE: 'report',
};

const PIPELINE_PROCESS_STATE_LABEL: Record<ClientWorkflowStage, string> = {
  INVITED: 'not started',
  REGISTERED: 'not started',
  INTAKE_IN_PROGRESS: 'in progress',
  INTAKE_COMPLETE: 'complete',
  ASSESSMENT_IN_PROGRESS: 'in progress',
  ASSESSMENT_COMPLETE: 'complete',
  DOCUMENTS_REQUIRED: 'in progress',
  COMPLETE: 'complete',
};

/** Advisor pipeline process phase (intake, assessment, report). */
export function getAdvisorPipelineProcessLabel(
  stage: ClientWorkflowStage,
  documentRequirementsEnabled = true,
): string {
  const displayStage = resolveAdvisorPipelineDisplayStage(
    stage,
    documentRequirementsEnabled,
  );
  return PIPELINE_PROCESS_LABEL[displayStage];
}

/** Advisor pipeline process state as plain text (not started, in progress, complete). */
export function getAdvisorPipelineProcessStateLabel(
  stage: ClientWorkflowStage,
  documentRequirementsEnabled = true,
): string {
  const displayStage = resolveAdvisorPipelineDisplayStage(
    stage,
    documentRequirementsEnabled,
  );
  return PIPELINE_PROCESS_STATE_LABEL[displayStage];
}

/**
 * Returns human-friendly stage labels (process · state) for filters and legacy copy.
 */
export function getStageLabel(stage: ClientWorkflowStage): string {
  const process = PIPELINE_PROCESS_LABEL[stage];
  const state = PIPELINE_PROCESS_STATE_LABEL[stage];
  return `${capitalizePipelineLabel(process)} · ${state}`;
}

function capitalizePipelineLabel(label: string): string {
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/** Maps document-gated stages when firm document requirements are hidden in advisor UI. */
export function resolveAdvisorPipelineDisplayStage(
  stage: ClientWorkflowStage,
  documentRequirementsEnabled = true,
): ClientWorkflowStage {
  if (!documentRequirementsEnabled && stage === 'DOCUMENTS_REQUIRED') {
    return 'ASSESSMENT_COMPLETE';
  }
  return stage;
}

/** Combined process · state for tooltips and compact summaries. */
export function getAdvisorPipelineStageLabel(
  stage: ClientWorkflowStage,
  documentRequirementsEnabled = true,
): string {
  const process = getAdvisorPipelineProcessLabel(stage, documentRequirementsEnabled);
  const state = getAdvisorPipelineProcessStateLabel(stage, documentRequirementsEnabled);
  return `${capitalizePipelineLabel(process)} · ${state}`;
}

export const PIPELINE_PROCESS_PHASES = ['intake', 'assessment', 'report'] as const;
export type PipelineProcessPhase = (typeof PIPELINE_PROCESS_PHASES)[number];

export const PIPELINE_PROCESS_STATES = [
  'not started',
  'in progress',
  'complete',
] as const;
export type PipelineProcessState = (typeof PIPELINE_PROCESS_STATES)[number];

export type PipelineProcessStateCounts = Record<
  PipelineProcessPhase,
  Record<PipelineProcessState, number>
>;

export function createEmptyPipelineProcessStateCounts(): PipelineProcessStateCounts {
  return {
    intake: { 'not started': 0, 'in progress': 0, complete: 0 },
    assessment: { 'not started': 0, 'in progress': 0, complete: 0 },
    report: { 'not started': 0, 'in progress': 0, complete: 0 },
  };
}

/** Roll up raw stage counts into intake / assessment / report by state. */
export function aggregatePipelineMetricsByProcessState(
  byStage: Record<ClientWorkflowStage, number>,
  documentRequirementsEnabled = true,
): PipelineProcessStateCounts {
  const counts = createEmptyPipelineProcessStateCounts();

  for (const stage of Object.keys(byStage) as ClientWorkflowStage[]) {
    const count = byStage[stage] ?? 0;
    if (count <= 0) continue;

    const displayStage = resolveAdvisorPipelineDisplayStage(
      stage,
      documentRequirementsEnabled,
    );
    const process = PIPELINE_PROCESS_LABEL[displayStage] as PipelineProcessPhase;
    const state = PIPELINE_PROCESS_STATE_LABEL[displayStage] as PipelineProcessState;
    counts[process][state] += count;
  }

  return counts;
}

export const PIPELINE_MONITORING_PHASE = 'monitoring' as const;
export type PipelineChevronPhase =
  | PipelineProcessPhase
  | typeof PIPELINE_MONITORING_PHASE;

export type PipelineChevronStepStatus = 'complete' | 'current' | 'future';

export const PIPELINE_CHEVRON_LABELS: Record<PipelineChevronPhase, string> = {
  intake: 'Intake',
  assessment: 'Assessment',
  report: 'Report',
  monitoring: 'Monitoring',
};

/** @deprecated Use PIPELINE_CHEVRON_LABELS */
export const PIPELINE_CHEVRON_SHORT_LABELS = PIPELINE_CHEVRON_LABELS;

/** Ordered chevron phases for the pipeline journey rail. */
export function getPipelineChevronPhases(
  monitoringEnabled = false,
): PipelineChevronPhase[] {
  return monitoringEnabled
    ? ['intake', 'assessment', 'report', 'monitoring']
    : ['intake', 'assessment', 'report'];
}

/** Maps workflow stage to completed and active chevron indices. */
export function getPipelineChevronProgress(
  stage: ClientWorkflowStage,
  documentRequirementsEnabled = true,
  monitoringEnabled = false,
): { completedThrough: number; activeIndex: number } {
  const displayStage = resolveAdvisorPipelineDisplayStage(
    stage,
    documentRequirementsEnabled,
  );
  const lastIndex = getPipelineChevronPhases(monitoringEnabled).length - 1;

  switch (displayStage) {
    case 'INVITED':
    case 'REGISTERED':
    case 'INTAKE_IN_PROGRESS':
      return { completedThrough: -1, activeIndex: 0 };
    case 'INTAKE_COMPLETE':
      return { completedThrough: 0, activeIndex: 1 };
    case 'ASSESSMENT_IN_PROGRESS':
      return { completedThrough: 0, activeIndex: 1 };
    case 'ASSESSMENT_COMPLETE':
      return { completedThrough: 1, activeIndex: 2 };
    case 'DOCUMENTS_REQUIRED':
      return { completedThrough: 1, activeIndex: 2 };
    case 'COMPLETE':
      return { completedThrough: lastIndex, activeIndex: lastIndex };
    default:
      return { completedThrough: -1, activeIndex: 0 };
  }
}

export function getPipelineChevronStepStatus(
  phaseIndex: number,
  progress: { completedThrough: number; activeIndex: number },
): PipelineChevronStepStatus {
  if (phaseIndex <= progress.completedThrough) return 'complete';
  if (phaseIndex === progress.activeIndex) return 'current';
  return 'future';
}

/**
 * Returns numeric order for stage sorting
 */
export function getStageOrder(stage: ClientWorkflowStage): number {
  const orderMap: Record<ClientWorkflowStage, number> = {
    INVITED: 0,
    REGISTERED: 1,
    INTAKE_IN_PROGRESS: 2,
    INTAKE_COMPLETE: 3,
    ASSESSMENT_IN_PROGRESS: 4,
    ASSESSMENT_COMPLETE: 5,
    DOCUMENTS_REQUIRED: 6,
    COMPLETE: 7,
  };

  return orderMap[stage];
}

/**
 * Determines if a client is stalled (no activity for more than 7 days).
 * Uses whole calendar days since last activity.
 */
export function isStalled(lastActivity: Date, stage: ClientWorkflowStage): boolean {
  if (stage === 'COMPLETE') return false;

  const daysSinceActivity = Math.floor(
    (Date.now() - lastActivity.getTime()) / (1000 * 60 * 60 * 24),
  );
  return daysSinceActivity > 7;
}

/** True when inactive long enough for advisor escalation emails (US-36). */
export function isWorkflowEscalation(lastActivity: Date, stage: ClientWorkflowStage): boolean {
  if (stage === 'COMPLETE') return false;

  const daysSinceActivity = Math.floor(
    (Date.now() - lastActivity.getTime()) / (1000 * 60 * 60 * 24),
  );
  return daysSinceActivity > 30;
}
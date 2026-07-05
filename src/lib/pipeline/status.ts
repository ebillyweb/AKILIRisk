import { ClientWorkflowStage, InvitationStatus, IntakeStatus, AssessmentStatus } from '@prisma/client';

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
      if (documents && documents.required > 0) {
        return documents.fulfilled < documents.required
          ? 'DOCUMENTS_REQUIRED'
          : 'COMPLETE';
      }
      // Assessment finished and no mandatory documents (or none outstanding)
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

/**
 * Returns human-friendly stage labels
 */
export function getStageLabel(stage: ClientWorkflowStage): string {
  const labelMap: Record<ClientWorkflowStage, string> = {
    INVITED: 'Invited',
    REGISTERED: 'Registered',
    INTAKE_IN_PROGRESS: 'Intake In Progress',
    INTAKE_COMPLETE: 'Intake Complete',
    ASSESSMENT_IN_PROGRESS: 'In Progress',
    ASSESSMENT_COMPLETE: 'Assessment Complete',
    DOCUMENTS_REQUIRED: 'Documents Required',
    COMPLETE: 'Complete',
  };

  return labelMap[stage];
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

export function getAdvisorPipelineStageLabel(
  stage: ClientWorkflowStage,
  documentRequirementsEnabled = true,
): string {
  return getStageLabel(
    resolveAdvisorPipelineDisplayStage(stage, documentRequirementsEnabled),
  );
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
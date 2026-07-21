import { describe, expect, it } from 'vitest';

import {
  aggregateMandatoryDocumentCounts,
  hasUnfulfilledMandatoryDocuments,
} from './documents';
import { validateStoredDocumentMime } from '@/lib/documents/validation';

import { computeClientStage, isStalled, isWorkflowEscalation, aggregatePipelineMetricsByProcessState, getAdvisorPipelineProcessLabel, getAdvisorPipelineProcessStateLabel, getAdvisorPipelineStageLabel, getPipelineChevronPhases, getPipelineChevronProgress, getPipelineChevronStepStatus, resolveAdvisorPipelineDisplayStage } from './status';

describe('aggregateMandatoryDocumentCounts', () => {
  it('counts only required rows per client', () => {
    const map = aggregateMandatoryDocumentCounts([
      { clientId: 'c1', required: true, fulfilled: true },
      { clientId: 'c1', required: true, fulfilled: false },
      { clientId: 'c1', required: false, fulfilled: false },
    ]);

    expect(map.get('c1')).toEqual({ required: 2, fulfilled: 1 });
  });
});

describe('computeClientStage — documents', () => {
  const base = {
    assessment: {
      status: 'COMPLETED' as const,
      updatedAt: new Date(),
      completedAt: new Date(),
    },
  };

  it('returns ASSESSMENT_COMPLETE when scored but Risk Profile is still PREVIEW', () => {
    expect(
      computeClientStage({
        ...base,
        assessment: {
          ...base.assessment,
          deliverablePhase: 'PREVIEW',
        },
        documents: { required: 0, fulfilled: 0 },
      }),
    ).toBe('ASSESSMENT_COMPLETE');
  });

  it('returns COMPLETE when profile is published and there are no mandatory documents', () => {
    expect(
      computeClientStage({
        ...base,
        assessment: {
          ...base.assessment,
          deliverablePhase: 'PROFILE',
        },
        documents: { required: 0, fulfilled: 0 },
      }),
    ).toBe('COMPLETE');
  });

  it('returns DOCUMENTS_REQUIRED when profile is published and mandatory docs remain', () => {
    expect(
      computeClientStage({
        ...base,
        assessment: {
          ...base.assessment,
          deliverablePhase: 'PROFILE',
        },
        documents: { required: 2, fulfilled: 1 },
      }),
    ).toBe('DOCUMENTS_REQUIRED');
  });

  it('returns COMPLETE when all mandatory docs are fulfilled and profile is published', () => {
    expect(
      computeClientStage({
        ...base,
        assessment: {
          ...base.assessment,
          deliverablePhase: 'PORTFOLIO',
        },
        documents: { required: 2, fulfilled: 2 },
      }),
    ).toBe('COMPLETE');
  });

  it('keeps ASSESSMENT_COMPLETE for PREVIEW even when documents remain', () => {
    expect(
      computeClientStage({
        ...base,
        assessment: {
          ...base.assessment,
          deliverablePhase: 'PREVIEW',
        },
        documents: { required: 2, fulfilled: 0 },
      }),
    ).toBe('ASSESSMENT_COMPLETE');
  });

  it('returns ASSESSMENT_IN_PROGRESS when latest assessment is in progress', () => {
    expect(
      computeClientStage({
        assessment: {
          status: 'IN_PROGRESS',
          updatedAt: new Date(),
        },
      }),
    ).toBe('ASSESSMENT_IN_PROGRESS');
  });

  it('returns INTAKE_COMPLETE ahead of invitation REGISTERED', () => {
    expect(
      computeClientStage({
        invitation: {
          status: 'REGISTERED',
          statusUpdatedAt: new Date(),
        },
        intake: {
          status: 'SUBMITTED',
          updatedAt: new Date(),
          submittedAt: new Date(),
        },
      }),
    ).toBe('INTAKE_COMPLETE');
  });
});

describe('hasUnfulfilledMandatoryDocuments', () => {
  it('is true when mandatory fulfilled < mandatory total', () => {
    expect(hasUnfulfilledMandatoryDocuments({ required: 3, fulfilled: 1 })).toBe(true);
  });

  it('is false when all mandatory docs are done', () => {
    expect(hasUnfulfilledMandatoryDocuments({ required: 2, fulfilled: 2 })).toBe(false);
  });
});

describe('resolveAdvisorPipelineDisplayStage', () => {
  it('maps DOCUMENTS_REQUIRED to assessment complete when documents UI is hidden', () => {
    expect(
      resolveAdvisorPipelineDisplayStage('DOCUMENTS_REQUIRED', false),
    ).toBe('ASSESSMENT_COMPLETE');
    expect(
      getAdvisorPipelineStageLabel('DOCUMENTS_REQUIRED', false),
    ).toBe('Assessment · complete');
  });

  it('preserves DOCUMENTS_REQUIRED when documents UI is enabled', () => {
    expect(
      resolveAdvisorPipelineDisplayStage('DOCUMENTS_REQUIRED', true),
    ).toBe('DOCUMENTS_REQUIRED');
    expect(
      getAdvisorPipelineStageLabel('DOCUMENTS_REQUIRED', true),
    ).toBe('Report · in progress');
  });
});

describe('advisor pipeline process labels', () => {
  it('maps intake stages to intake process', () => {
    expect(getAdvisorPipelineProcessLabel('INTAKE_IN_PROGRESS')).toBe('intake');
    expect(getAdvisorPipelineProcessStateLabel('INTAKE_IN_PROGRESS')).toBe('in progress');
    expect(getAdvisorPipelineProcessStateLabel('INTAKE_COMPLETE')).toBe('complete');
  });

  it('maps assessment stages to assessment process', () => {
    expect(getAdvisorPipelineProcessLabel('ASSESSMENT_IN_PROGRESS')).toBe('assessment');
    expect(getAdvisorPipelineProcessStateLabel('ASSESSMENT_COMPLETE')).toBe('complete');
  });

  it('maps report stages when documents are required or workflow is complete', () => {
    expect(getAdvisorPipelineProcessLabel('DOCUMENTS_REQUIRED')).toBe('report');
    expect(getAdvisorPipelineProcessLabel('COMPLETE')).toBe('report');
    expect(getAdvisorPipelineProcessStateLabel('COMPLETE')).toBe('complete');
  });
});

describe('aggregatePipelineMetricsByProcessState', () => {
  it('rolls stage counts into process and state buckets', () => {
    const byStage = {
      INVITED: 2,
      REGISTERED: 1,
      INTAKE_IN_PROGRESS: 3,
      INTAKE_COMPLETE: 4,
      ASSESSMENT_IN_PROGRESS: 5,
      ASSESSMENT_COMPLETE: 2,
      DOCUMENTS_REQUIRED: 1,
      COMPLETE: 6,
    };

    expect(aggregatePipelineMetricsByProcessState(byStage)).toEqual({
      intake: { 'not started': 3, 'in progress': 3, complete: 4 },
      assessment: { 'not started': 0, 'in progress': 5, complete: 2 },
      report: { 'not started': 0, 'in progress': 1, complete: 6 },
    });
  });

  it('maps documents-required clients to assessment complete when documents UI is hidden', () => {
    const byStage = {
      INVITED: 0,
      REGISTERED: 0,
      INTAKE_IN_PROGRESS: 0,
      INTAKE_COMPLETE: 0,
      ASSESSMENT_IN_PROGRESS: 0,
      ASSESSMENT_COMPLETE: 0,
      DOCUMENTS_REQUIRED: 2,
      COMPLETE: 1,
    };

    expect(aggregatePipelineMetricsByProcessState(byStage, false)).toEqual({
      intake: { 'not started': 0, 'in progress': 0, complete: 0 },
      assessment: { 'not started': 0, 'in progress': 0, complete: 2 },
      report: { 'not started': 0, 'in progress': 0, complete: 1 },
    });
  });
});

describe('pipeline chevron progress', () => {
  it('returns three phases when monitoring is disabled', () => {
    expect(getPipelineChevronPhases(false)).toEqual([
      'intake',
      'assessment',
      'report',
    ]);
  });

  it('returns four phases when monitoring is enabled', () => {
    expect(getPipelineChevronPhases(true)).toEqual([
      'intake',
      'assessment',
      'report',
      'monitoring',
    ]);
  });

  it('marks intake complete and assessment current after intake completes', () => {
    const progress = getPipelineChevronProgress('INTAKE_COMPLETE');
    expect(progress).toEqual({ completedThrough: 0, activeIndex: 1 });
    expect(getPipelineChevronStepStatus(0, progress)).toBe('complete');
    expect(getPipelineChevronStepStatus(1, progress)).toBe('current');
    expect(getPipelineChevronStepStatus(2, progress)).toBe('future');
  });

  it('places completed clients on the monitoring chevron when enabled', () => {
    const progress = getPipelineChevronProgress('COMPLETE', true, true);
    expect(progress).toEqual({ completedThrough: 3, activeIndex: 3 });
    expect(getPipelineChevronStepStatus(3, progress)).toBe('complete');
  });
});

describe('isStalled vs isWorkflowEscalation', () => {
  const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
  const twentyDaysAgo = new Date(Date.now() - 20 * 24 * 60 * 60 * 1000);
  const thirtyOneDaysAgo = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000);

  it('flags stall after more than 7 days', () => {
    expect(isStalled(eightDaysAgo, 'INTAKE_IN_PROGRESS')).toBe(true);
    expect(isStalled(twentyDaysAgo, 'INTAKE_IN_PROGRESS')).toBe(true);
  });

  it('does not flag complete clients as stalled', () => {
    expect(isStalled(eightDaysAgo, 'COMPLETE')).toBe(false);
  });

  it('rejects disallowed MIME from storage HEAD', () => {
    expect(validateStoredDocumentMime('text/plain').valid).toBe(false);
    expect(validateStoredDocumentMime('application/pdf').valid).toBe(true);
  });

  it('escalates only after more than 30 days', () => {
    expect(isWorkflowEscalation(twentyDaysAgo, 'INTAKE_IN_PROGRESS')).toBe(false);
    expect(isWorkflowEscalation(thirtyOneDaysAgo, 'INTAKE_IN_PROGRESS')).toBe(true);
  });
});

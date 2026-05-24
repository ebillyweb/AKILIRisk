import { describe, expect, it } from 'vitest';

import {
  aggregateMandatoryDocumentCounts,
  hasUnfulfilledMandatoryDocuments,
} from './documents';
import { validateStoredDocumentMime } from '@/lib/documents/validation';

import { computeClientStage, isStalled, isWorkflowEscalation } from './status';

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

  it('returns DOCUMENTS_REQUIRED when mandatory docs remain', () => {
    expect(
      computeClientStage({
        ...base,
        documents: { required: 2, fulfilled: 1 },
      }),
    ).toBe('DOCUMENTS_REQUIRED');
  });

  it('returns COMPLETE when all mandatory docs are fulfilled', () => {
    expect(
      computeClientStage({
        ...base,
        documents: { required: 2, fulfilled: 2 },
      }),
    ).toBe('COMPLETE');
  });

  it('returns COMPLETE when there are no mandatory documents', () => {
    expect(
      computeClientStage({
        ...base,
        documents: { required: 0, fulfilled: 0 },
      }),
    ).toBe('COMPLETE');
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
});

describe('hasUnfulfilledMandatoryDocuments', () => {
  it('is true when mandatory fulfilled < mandatory total', () => {
    expect(hasUnfulfilledMandatoryDocuments({ required: 3, fulfilled: 1 })).toBe(true);
  });

  it('is false when all mandatory docs are done', () => {
    expect(hasUnfulfilledMandatoryDocuments({ required: 2, fulfilled: 2 })).toBe(false);
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

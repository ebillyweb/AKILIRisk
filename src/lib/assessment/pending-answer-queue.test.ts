import { describe, expect, it } from 'vitest';
import {
  enqueuePendingAnswer,
  pendingAnswerCount,
  shiftPendingAnswer,
  type PendingAnswerSave,
} from './pending-answer-queue';

function params(questionId: string, answer: unknown): PendingAnswerSave {
  return {
    questionId,
    pillar: 'governance',
    subCategory: 'governance',
    answer,
  };
}

describe('pending-answer-queue', () => {
  it('preserves FIFO order across different questions', () => {
    const queue = new Map<string, PendingAnswerSave>();
    enqueuePendingAnswer(queue, params('q1', 1));
    enqueuePendingAnswer(queue, params('q2', 2));
    enqueuePendingAnswer(queue, params('q3', 3));

    expect(shiftPendingAnswer(queue)?.questionId).toBe('q1');
    expect(shiftPendingAnswer(queue)?.questionId).toBe('q2');
    expect(shiftPendingAnswer(queue)?.questionId).toBe('q3');
    expect(pendingAnswerCount(queue)).toBe(0);
  });

  it('replaces the pending save when the same question is updated', () => {
    const queue = new Map<string, PendingAnswerSave>();
    enqueuePendingAnswer(queue, params('q1', 1));
    enqueuePendingAnswer(queue, params('q2', 2));
    enqueuePendingAnswer(queue, params('q1', 3));

    expect(pendingAnswerCount(queue)).toBe(2);
    expect(shiftPendingAnswer(queue)?.answer).toBe(3);
    expect(shiftPendingAnswer(queue)?.answer).toBe(2);
  });
});

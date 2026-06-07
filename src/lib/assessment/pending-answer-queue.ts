/** Params mirrored from useAutoSave — kept here for queue unit tests. */
export type PendingAnswerSave = {
  questionId: string;
  pillar: string;
  subCategory: string;
  answer: unknown;
  skipped?: boolean;
  currentQuestionIndex?: number;
  orphanedQuestionIds?: string[];
};

/** Latest save per question wins; Map iteration order preserves FIFO across questions. */
export function enqueuePendingAnswer(
  queue: Map<string, PendingAnswerSave>,
  params: PendingAnswerSave
): void {
  queue.set(params.questionId, params);
}

/** Removes and returns the oldest pending save, if any. */
export function shiftPendingAnswer(
  queue: Map<string, PendingAnswerSave>
): PendingAnswerSave | undefined {
  const firstKey = queue.keys().next().value as string | undefined;
  if (firstKey === undefined) return undefined;
  const params = queue.get(firstKey);
  queue.delete(firstKey);
  return params;
}

export function pendingAnswerCount(queue: Map<string, PendingAnswerSave>): number {
  return queue.size;
}

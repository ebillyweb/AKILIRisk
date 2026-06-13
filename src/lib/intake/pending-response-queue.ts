export type PendingIntakeSave = {
  questionId: string;
  transcription?: string;
  audioUrl?: string;
  audioDuration?: number;
  skipped?: boolean;
};

export function enqueuePendingIntakeSave(
  queue: Map<string, PendingIntakeSave>,
  params: PendingIntakeSave,
): void {
  queue.set(params.questionId, params);
}

export function shiftPendingIntakeSave(
  queue: Map<string, PendingIntakeSave>,
): PendingIntakeSave | undefined {
  const firstKey = queue.keys().next().value as string | undefined;
  if (firstKey === undefined) return undefined;
  const params = queue.get(firstKey);
  queue.delete(firstKey);
  return params;
}

export function pendingIntakeSaveCount(queue: Map<string, PendingIntakeSave>): number {
  return queue.size;
}

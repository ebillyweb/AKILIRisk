/**
 * Queued pillar recommended actions stored on the active Report DRAFT.
 * Advisors queue items while reviewing intake/assessment answers; the
 * draft edit page and published report preview surface the list.
 */

export type QueuedPillarAction = {
  id: string;
  questionId: string;
  questionLabel: string;
  pillar: string | null;
  source: "intake" | "assessment";
  actionText: string;
  queuedAt: string;
  queuedByUserId: string;
};

export function parseQueuedPillarActions(raw: unknown): QueuedPillarAction[] {
  if (!Array.isArray(raw)) return [];
  const out: QueuedPillarAction[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    if (
      typeof row.id !== "string" ||
      typeof row.questionId !== "string" ||
      typeof row.actionText !== "string" ||
      typeof row.queuedAt !== "string" ||
      typeof row.queuedByUserId !== "string"
    ) {
      continue;
    }
    out.push({
      id: row.id,
      questionId: row.questionId,
      questionLabel:
        typeof row.questionLabel === "string" ? row.questionLabel : row.questionId,
      pillar: typeof row.pillar === "string" ? row.pillar : null,
      source: row.source === "intake" ? "intake" : "assessment",
      actionText: row.actionText,
      queuedAt: row.queuedAt,
      queuedByUserId: row.queuedByUserId,
    });
  }
  return out;
}

export function isDuplicateQueuedAction(
  existing: QueuedPillarAction[],
  questionId: string,
  actionText: string
): boolean {
  const normalized = actionText.trim();
  return existing.some(
    (a) => a.questionId === questionId && a.actionText.trim() === normalized
  );
}

/**
 * Conflict rule for intake response writes (mobile plan §8.2): the server is
 * the source of truth on first sync. A client write is "stale" — and must be
 * discarded — when the server already holds a strictly newer value for the
 * same (interviewId, questionId).
 *
 * A missing existing record or a missing/invalid incoming timestamp is treated
 * as non-stale (apply the write).
 */
export function isStaleWrite(
  existingUpdatedAt: Date | null | undefined,
  incomingUpdatedAt: string | null | undefined,
): boolean {
  if (!existingUpdatedAt || !incomingUpdatedAt) return false;
  const incoming = new Date(incomingUpdatedAt);
  if (Number.isNaN(incoming.getTime())) return false;
  return existingUpdatedAt.getTime() > incoming.getTime();
}

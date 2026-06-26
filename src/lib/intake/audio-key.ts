/**
 * S3 key helpers for intake voice answers.
 *
 * The key is deterministic per (interviewId, questionId) — stable across
 * retries so a re-upload overwrites the same object instead of orphaning a new
 * one — and namespaced by interview so a stored key can be validated as
 * belonging to its interview (preventing cross-tenant object access).
 */

export function intakeAudioPrefix(interviewId: string): string {
  return `intake/${interviewId}/`;
}

/** Strips anything unsafe for an S3 key path segment (no traversal, no slashes). */
export function sanitizeQuestionId(questionId: string): string {
  return questionId.replace(/[^a-zA-Z0-9_-]/g, "");
}

/** Deterministic, interview-scoped S3 key for a question's voice answer. */
export function intakeAudioKey(interviewId: string, questionId: string): string {
  return `${intakeAudioPrefix(interviewId)}${sanitizeQuestionId(questionId)}.m4a`;
}

/** True only if `key` is a non-empty string under the interview's audio namespace. */
export function isOwnedIntakeAudioKey(
  key: string | null | undefined,
  interviewId: string,
): boolean {
  return typeof key === "string" && key.startsWith(intakeAudioPrefix(interviewId));
}

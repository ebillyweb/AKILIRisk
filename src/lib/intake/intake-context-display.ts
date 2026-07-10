/** Fallback coaching copy when a question has no authored context. */
export const DEFAULT_INTAKE_INTERVIEW_CONTEXT =
  "Take your time; speak naturally as if in conversation with your advisor.";

/** Returns client-facing coaching context, omitting the generic fallback. */
export function intakeContextForDisplay(context: string | undefined | null): string | null {
  const trimmed = context?.trim();
  if (!trimmed || trimmed === DEFAULT_INTAKE_INTERVIEW_CONTEXT) return null;
  return trimmed;
}

import "server-only";

const PREVIEW_SUBJECT_PREFIX = "[PREVIEW] ";

export function isPreviewEmailEnvironment(): boolean {
  return process.env.VERCEL_ENV === "preview";
}

/** Prefix outbound Resend subjects on Vercel Preview deployments. */
export function formatEmailSubject(subject: string): string {
  const trimmed = subject.trim();
  if (!isPreviewEmailEnvironment()) return trimmed;
  if (trimmed.startsWith(PREVIEW_SUBJECT_PREFIX)) return trimmed;
  return `${PREVIEW_SUBJECT_PREFIX}${trimmed}`;
}

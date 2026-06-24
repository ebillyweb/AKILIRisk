export function facilitatedSessionRoot(sessionId: string): string {
  return `/advisor/facilitate/${sessionId}`;
}

export function facilitatedIntakePath(sessionId: string): string {
  return `${facilitatedSessionRoot(sessionId)}/intake`;
}

export function facilitatedPillarsPath(sessionId: string): string {
  return `${facilitatedSessionRoot(sessionId)}/pillars`;
}

export function facilitatedAssessmentHubPath(
  sessionId: string,
  options?: { resume?: boolean },
): string {
  const base = `${facilitatedSessionRoot(sessionId)}/assessment`;
  return options?.resume ? `${base}?resume=1` : base;
}

export function facilitatedAssessmentQuestionPath(
  sessionId: string,
  pillarSlug: string,
  questionIndex: number,
): string {
  return `${facilitatedAssessmentHubPath(sessionId)}/${pillarSlug}/${questionIndex}`;
}

export function facilitatedAssessmentCompletePath(sessionId: string): string {
  return `${facilitatedSessionRoot(sessionId)}/assessment/complete`;
}

export function facilitatedPreviewPath(sessionId: string): string {
  return `${facilitatedSessionRoot(sessionId)}/preview`;
}

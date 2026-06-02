/** Authenticated streaming URL for a stored intake voice response. */
export function intakeResponsePlaybackUrl(
  interviewId: string,
  questionId: string,
): string {
  return `/api/intake/${interviewId}/audio/${questionId}`;
}

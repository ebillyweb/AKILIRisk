/** Whether an intake row carries a client answer (voice, typed, or skipped with timestamp). */
export function intakeResponseHasClientAnswer(response: {
  answeredAt?: Date | string | null;
  audioUrl?: string | null;
  audioS3Key?: string | null;
  hasTranscription?: boolean;
  transcription?: string | null;
}): boolean {
  if (response.answeredAt != null) return true;
  if (response.audioUrl || response.audioS3Key) return true;
  if (response.hasTranscription) return true;
  return Boolean(response.transcription?.trim());
}

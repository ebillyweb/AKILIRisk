import type { InterviewResponse } from "@/lib/intake/store";

/** True when the user may advance: completed audio, typed answer, or skipped. */
export function isInterviewResponseComplete(
  r: InterviewResponse | undefined
): boolean {
  if (!r) return false;
  if (r.skipped) return true;
  if (r.status !== "completed") return false;
  if (r.audioUrl) return true;
  return Boolean(r.transcription?.trim());
}

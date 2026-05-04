import "server-only";

/**
 * In-memory dedupe for audio-stream audit writes.
 *
 * The HTML `<audio>` element issues range requests (typically a HEAD-like
 * probe followed by N partial GETs as the user scrubs) — auditing each
 * would produce dozens of rows for one playback. We dedupe by the actor +
 * resource tuple so one playback session = one audit row, with a 5-minute
 * window that comfortably covers the longest reasonable single-question
 * answer (the 25MB cap on uploads bounds answer length).
 *
 * Per-instance state. On serverless this is per-cold-container, which is
 * fine for volume control: the worst case is a handful of duplicate rows
 * per minute across containers, far less than the unbounded growth without
 * dedupe. NOT a security gate — anyone authorized to stream the audio is
 * authorized regardless of whether the access is audited.
 */

const DEDUPE_WINDOW_MS = 5 * 60 * 1000; // 5 minutes
const CLEANUP_CUTOFF_MS = 10 * 60 * 1000; // garbage-collect entries older than 10 min
const SIZE_THRESHOLD_FOR_CLEANUP = 1000;

// Exported for unit tests. Cleared between test runs via clearAudioStreamDedupe().
export const audioStreamDedupe = new Map<string, number>();

function dedupeKey(actorUserId: string, interviewId: string, questionId: string): string {
  return `${actorUserId}:${interviewId}:${questionId}`;
}

/**
 * Returns true if this audio-stream access should produce an audit row,
 * false if it's within the dedupe window of a recent access by the same
 * actor for the same resource. Mutates the dedupe map.
 *
 * Cheap garbage collection: when the map grows past `SIZE_THRESHOLD_FOR_CLEANUP`,
 * sweep entries older than `CLEANUP_CUTOFF_MS`. Amortizes O(1) per call;
 * O(N) on the cleanup pass which is ~rare. The threshold + cutoff combination
 * means the steady-state size for an active deployment is bounded by the
 * number of distinct (advisor, interview, question) tuples played in a
 * 10-minute window — typically << 1000 even at scale.
 */
export function shouldAuditAudioStream(
  actorUserId: string,
  interviewId: string,
  questionId: string,
  now: number = Date.now()
): boolean {
  const key = dedupeKey(actorUserId, interviewId, questionId);
  const last = audioStreamDedupe.get(key);
  if (last !== undefined && now - last < DEDUPE_WINDOW_MS) {
    return false;
  }
  audioStreamDedupe.set(key, now);

  if (audioStreamDedupe.size > SIZE_THRESHOLD_FOR_CLEANUP) {
    const cutoff = now - CLEANUP_CUTOFF_MS;
    for (const [k, t] of audioStreamDedupe) {
      if (t < cutoff) {
        audioStreamDedupe.delete(k);
      }
    }
  }

  return true;
}

/** Test helper. Don't call from production code. */
export function clearAudioStreamDedupe(): void {
  audioStreamDedupe.clear();
}

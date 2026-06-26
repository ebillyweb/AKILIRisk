import {
  confirmVoiceResponse,
  presignAudioUpload,
  putTypedResponse,
  uploadAudio,
} from '@/api/intake';
import {
  deleteWrite,
  getPendingWrites,
  recordFailure,
  type OutboxRow,
} from '@/db/outbox';
import { setDraftSyncState } from '@/db/drafts';
import { shouldDeadLetter } from './retryPolicy';

let draining = false;
// Set when a sync is requested while a drain is already in flight, so the
// in-flight drain re-scans the outbox before finishing (a save during a drain
// must not be left stranded until the next NetInfo/AppState event).
let rerunRequested = false;

async function processRow(row: OutboxRow): Promise<void> {
  if (row.mode === 'TYPE') {
    await putTypedResponse(
      {
        interviewId: row.interviewId,
        questionId: row.questionId,
        text: row.text ?? '',
        updatedAt: row.updatedAt,
      },
      row.id,
    );
  } else {
    if (!row.audioUri) {
      // Plain Error → treated as transient (retried), not a permanent
      // dead-letter, so a momentarily-unavailable file recovers.
      throw new Error('Audio file not available yet for voice answer');
    }
    // Deterministic key (server-side): a retry re-uploads to the same object
    // instead of orphaning a new one.
    const { uploadUrl, fileKey } = await presignAudioUpload(row.interviewId, row.questionId);
    await uploadAudio(uploadUrl, row.audioUri);
    await confirmVoiceResponse(
      {
        interviewId: row.interviewId,
        questionId: row.questionId,
        fileKey,
        updatedAt: row.updatedAt,
      },
      row.id,
    );
    // NOTE: the local audio file is intentionally NOT evicted here — the draft
    // still references it for in-app playback/re-record, and eager eviction
    // previously broke retries. Cache cleanup happens on interview submission.
  }
}

/**
 * Drains the outbox in insertion order. Returns the number of writes synced.
 * Re-scans if a sync was requested mid-drain; stops on a transient/network
 * error so it can resume on the next reconnect/foreground event.
 */
export async function drainOutbox(): Promise<number> {
  if (draining) {
    rerunRequested = true;
    return 0;
  }
  draining = true;
  let synced = 0;
  try {
    do {
      rerunRequested = false;
      const pending = await getPendingWrites();
      let transientStop = false;
      for (const row of pending) {
        try {
          await processRow(row);
          await deleteWrite(row.id);
          await setDraftSyncState(row.questionId, 'SYNCED');
          synced += 1;
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Unknown error';
          const permanent = shouldDeadLetter(err, row.attempts);
          await recordFailure(row.id, message, permanent);
          if (permanent) {
            await setDraftSyncState(row.questionId, 'FAILED');
            continue; // skip this row, keep draining the rest
          }
          // Transient (offline / 5xx): stop; resume on the next event.
          transientStop = true;
          break;
        }
      }
      if (transientStop) break;
    } while (rerunRequested);
  } finally {
    draining = false;
  }
  return synced;
}

import * as FileSystem from 'expo-file-system';
import { ApiError } from '@/api/client';
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
    if (!row.audioUri) throw new ApiError(400, 'Missing audio file for voice answer');
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
    // Audio is durable in S3 — evict the local cache copy.
    await FileSystem.deleteAsync(row.audioUri, { idempotent: true }).catch(() => {});
  }
}

/**
 * Drains the outbox in insertion order. Returns the number of writes synced.
 * Stops early on a transient/network error so it can resume on reconnect.
 */
export async function drainOutbox(): Promise<number> {
  if (draining) return 0;
  draining = true;
  let synced = 0;
  try {
    const pending = await getPendingWrites();
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
        // Transient (offline / 5xx): stop and retry the whole queue later.
        break;
      }
    }
  } finally {
    draining = false;
  }
  return synced;
}

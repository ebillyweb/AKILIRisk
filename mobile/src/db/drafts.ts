import { getDb } from './database';
import type { ResponseMode, SyncState } from '@/types';

export interface DraftRow {
  questionId: string;
  interviewId: string;
  mode: ResponseMode;
  text: string | null;
  audioUri: string | null;
  updatedAt: string;
  syncState: SyncState;
}

/** Inserts or replaces the draft answer for a question. */
export async function upsertDraft(draft: DraftRow): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO drafts (questionId, interviewId, mode, text, audioUri, updatedAt, syncState)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(questionId) DO UPDATE SET
       interviewId = excluded.interviewId,
       mode = excluded.mode,
       text = excluded.text,
       audioUri = excluded.audioUri,
       updatedAt = excluded.updatedAt,
       syncState = excluded.syncState`,
    [
      draft.questionId,
      draft.interviewId,
      draft.mode,
      draft.text,
      draft.audioUri,
      draft.updatedAt,
      draft.syncState,
    ],
  );
}

export async function getDraftsForInterview(interviewId: string): Promise<DraftRow[]> {
  const db = await getDb();
  return db.getAllAsync<DraftRow>(
    'SELECT * FROM drafts WHERE interviewId = ?',
    [interviewId],
  );
}

export async function setDraftSyncState(
  questionId: string,
  syncState: SyncState,
): Promise<void> {
  const db = await getDb();
  await db.runAsync('UPDATE drafts SET syncState = ? WHERE questionId = ?', [
    syncState,
    questionId,
  ]);
}

/** True when every draft for the interview has synced (gates submission). */
export async function allDraftsSynced(interviewId: string): Promise<boolean> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ pending: number }>(
    `SELECT COUNT(*) AS pending FROM drafts
     WHERE interviewId = ? AND syncState != 'SYNCED'`,
    [interviewId],
  );
  return (row?.pending ?? 0) === 0;
}

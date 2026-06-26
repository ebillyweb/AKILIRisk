import * as Crypto from 'expo-crypto';
import { getDb } from './database';
import type { ResponseMode } from '@/types';

export interface OutboxRow {
  id: string;
  interviewId: string;
  questionId: string;
  mode: ResponseMode;
  text: string | null;
  audioUri: string | null;
  updatedAt: string;
  createdAt: string;
  attempts: number;
  status: 'PENDING' | 'DEAD';
  lastError: string | null;
}

export interface EnqueueInput {
  interviewId: string;
  questionId: string;
  mode: ResponseMode;
  text?: string | null;
  audioUri?: string | null;
  updatedAt: string;
}

/**
 * Adds a write to the outbox with a fresh UUID idempotency key.
 *
 * Per-question dedupe: any prior PENDING row for the same (interviewId,
 * questionId) is removed first, so only the latest write per question is ever
 * queued. This prevents a stale earlier edit from overwriting a newer one on
 * the server when rows drain out of order.
 */
export async function enqueueWrite(input: EnqueueInput): Promise<string> {
  const db = await getDb();
  const id = Crypto.randomUUID();
  const now = new Date().toISOString();
  await db.runAsync(
    `DELETE FROM outbox WHERE status = 'PENDING' AND interviewId = ? AND questionId = ?`,
    [input.interviewId, input.questionId],
  );
  await db.runAsync(
    `INSERT INTO outbox (id, interviewId, questionId, mode, text, audioUri, updatedAt, createdAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.interviewId,
      input.questionId,
      input.mode,
      input.text ?? null,
      input.audioUri ?? null,
      input.updatedAt,
      now,
    ],
  );
  return id;
}

/** Pending writes in insertion order (the sync worker drains these). */
export async function getPendingWrites(): Promise<OutboxRow[]> {
  const db = await getDb();
  return db.getAllAsync<OutboxRow>(
    `SELECT * FROM outbox WHERE status = 'PENDING' ORDER BY createdAt ASC`,
  );
}

export async function getDeadLetters(): Promise<OutboxRow[]> {
  const db = await getDb();
  return db.getAllAsync<OutboxRow>(
    `SELECT * FROM outbox WHERE status = 'DEAD' ORDER BY createdAt ASC`,
  );
}

export async function deleteWrite(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM outbox WHERE id = ?', [id]);
}

export async function recordFailure(
  id: string,
  error: string,
  dead: boolean,
): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `UPDATE outbox SET attempts = attempts + 1, lastError = ?, status = ? WHERE id = ?`,
    [error, dead ? 'DEAD' : 'PENDING', id],
  );
}

export async function countPending(): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ c: number }>(
    `SELECT COUNT(*) AS c FROM outbox WHERE status = 'PENDING'`,
  );
  return row?.c ?? 0;
}

/** Re-queues every dead-letter row for another attempt. */
export async function retryDeadLetters(): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `UPDATE outbox SET status = 'PENDING', attempts = 0, lastError = NULL WHERE status = 'DEAD'`,
  );
}

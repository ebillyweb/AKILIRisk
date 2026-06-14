import { ApiError } from '@/api/errors';

/** Outbox rows are dead-lettered after this many failed attempts. */
export const MAX_ATTEMPTS = 5;

/**
 * A 4xx (other than 408 Request Timeout / 429 Too Many Requests) is permanent —
 * retrying can't fix it, so the write should be dead-lettered rather than
 * looped (plan §8.2). Network errors and 5xx are transient.
 */
export function isPermanentError(err: unknown): boolean {
  return (
    err instanceof ApiError &&
    err.status >= 400 &&
    err.status < 500 &&
    err.status !== 408 &&
    err.status !== 429
  );
}

/** Whether an outbox row should move to the dead-letter table. */
export function shouldDeadLetter(err: unknown, attempts: number): boolean {
  return isPermanentError(err) || attempts + 1 >= MAX_ATTEMPTS;
}

import { ApiError } from '@/api/errors';
import { MAX_ATTEMPTS, isPermanentError, shouldDeadLetter } from '../retryPolicy';

describe('isPermanentError', () => {
  it('treats 4xx (except 408/429) as permanent', () => {
    expect(isPermanentError(new ApiError(400, 'bad'))).toBe(true);
    expect(isPermanentError(new ApiError(401, 'unauth'))).toBe(true);
    expect(isPermanentError(new ApiError(404, 'missing'))).toBe(true);
  });

  it('treats 408/429 as transient (retryable)', () => {
    expect(isPermanentError(new ApiError(408, 'timeout'))).toBe(false);
    expect(isPermanentError(new ApiError(429, 'rate limited'))).toBe(false);
  });

  it('treats 5xx and network errors as transient', () => {
    expect(isPermanentError(new ApiError(500, 'server'))).toBe(false);
    expect(isPermanentError(new ApiError(0, 'network'))).toBe(false);
    expect(isPermanentError(new Error('plain'))).toBe(false);
  });
});

describe('shouldDeadLetter', () => {
  it('dead-letters permanent errors immediately', () => {
    expect(shouldDeadLetter(new ApiError(400, 'bad'), 0)).toBe(true);
  });

  it('keeps transient errors queued until the attempt cap', () => {
    expect(shouldDeadLetter(new ApiError(500, 'server'), 0)).toBe(false);
    expect(shouldDeadLetter(new ApiError(500, 'server'), MAX_ATTEMPTS - 2)).toBe(false);
    // On the final attempt, give up even on transient failures.
    expect(shouldDeadLetter(new ApiError(500, 'server'), MAX_ATTEMPTS - 1)).toBe(true);
  });
});

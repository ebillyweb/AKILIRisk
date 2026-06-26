import { config } from '@/config';
import { ApiError } from './errors';

export { ApiError };

/**
 * Module-level bearer token. Set by AuthContext after sign-in so that both
 * React code and the background sync worker share one source of truth.
 */
let authToken: string | null = null;
export function setAuthToken(token: string | null) {
  authToken = token;
}

/** Invoked when the API returns 401 so the app can drop to the lock/email screen. */
let onUnauthorized: (() => void) | null = null;
export function setUnauthorizedHandler(fn: (() => void) | null) {
  onUnauthorized = fn;
}

interface RequestOptions extends Omit<RequestInit, 'body'> {
  json?: unknown;
  /** Idempotency-Key header value (outbox writes set this). */
  idempotencyKey?: string;
  raw?: boolean;
}

function buildUrl(path: string): string {
  if (path.startsWith('http')) return path;
  return `${config.apiBaseUrl}${path.startsWith('/') ? path : `/${path}`}`;
}

export async function apiRequest<T = unknown>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { json, idempotencyKey, raw, headers, ...rest } = options;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.requestTimeoutMs);

  const finalHeaders: Record<string, string> = {
    Accept: 'application/json',
    ...(headers as Record<string, string> | undefined),
  };
  if (authToken) finalHeaders.Authorization = `Bearer ${authToken}`;
  if (idempotencyKey) finalHeaders['Idempotency-Key'] = idempotencyKey;

  let body: BodyInit | undefined;
  if (json !== undefined) {
    finalHeaders['Content-Type'] = 'application/json';
    body = JSON.stringify(json);
  }

  let response: Response;
  try {
    response = await fetch(buildUrl(path), {
      ...rest,
      headers: finalHeaders,
      body,
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timeout);
    if (err instanceof Error && err.name === 'AbortError') {
      throw new ApiError(0, 'Request timed out. Check your connection and try again.');
    }
    throw new ApiError(0, 'Network error. Please check your connection.');
  } finally {
    clearTimeout(timeout);
  }

  if (response.status === 401) {
    onUnauthorized?.();
  }

  if (raw) return response as unknown as T;

  const contentType = response.headers.get('content-type') ?? '';
  const payload = contentType.includes('application/json')
    ? await response.json().catch(() => undefined)
    : await response.text().catch(() => undefined);

  if (!response.ok) {
    const message =
      payload && typeof payload === 'object' && 'error' in payload
        ? String((payload as { error: unknown }).error)
        : `Request failed (${response.status})`;
    throw new ApiError(response.status, message, payload);
  }

  return payload as T;
}

import { config } from '@/config';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public body?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface RequestOptions extends Omit<RequestInit, 'body'> {
  /** JSON-serializable body. */
  json?: unknown;
  /** URL-encoded form body (used by NextAuth credential callback). */
  form?: Record<string, string>;
  /** Skip JSON parsing and return the raw Response. */
  raw?: boolean;
}

function buildUrl(path: string): string {
  if (path.startsWith('http')) return path;
  return `${config.apiBaseUrl}${path.startsWith('/') ? path : `/${path}`}`;
}

/**
 * Thin fetch wrapper around the AkiliRisk web API.
 *
 * Session handling: the backend uses NextAuth cookie sessions. On native,
 * React Native's networking layer (NSURLSession / OkHttp) maintains a shared
 * cookie jar automatically, so the session cookie set during sign-in is
 * replayed on subsequent requests without manual header juggling.
 */
export async function apiRequest<T = unknown>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { json, form, raw, headers, ...rest } = options;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.requestTimeoutMs);

  const finalHeaders: Record<string, string> = {
    Accept: 'application/json',
    ...(headers as Record<string, string> | undefined),
  };

  let body: BodyInit | undefined;
  if (json !== undefined) {
    finalHeaders['Content-Type'] = 'application/json';
    body = JSON.stringify(json);
  } else if (form !== undefined) {
    finalHeaders['Content-Type'] = 'application/x-www-form-urlencoded';
    body = Object.entries(form)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join('&');
  }

  let response: Response;
  try {
    response = await fetch(buildUrl(path), {
      ...rest,
      headers: finalHeaders,
      body,
      credentials: 'include',
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

  if (raw) return response as unknown as T;

  const contentType = response.headers.get('content-type') ?? '';
  const payload = contentType.includes('application/json')
    ? await response.json().catch(() => undefined)
    : await response.text().catch(() => undefined);

  if (!response.ok) {
    const message =
      (payload && typeof payload === 'object' && 'error' in payload
        ? String((payload as { error: unknown }).error)
        : undefined) ?? `Request failed (${response.status})`;
    throw new ApiError(response.status, message, payload);
  }

  return payload as T;
}

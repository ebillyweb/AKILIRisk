import { apiRequest, ApiError } from './client';
import { SessionResponse, type SessionUser } from '@/types';

interface CsrfResponse {
  csrfToken: string;
}

/**
 * Signs in against the NextAuth credentials provider.
 *
 * NextAuth's credential callback requires a CSRF token and a form-encoded
 * body, then sets the session cookie via Set-Cookie (handled by the native
 * cookie jar). We then read the resolved session to obtain the user.
 */
export async function signIn(email: string, password: string): Promise<SessionUser> {
  const { csrfToken } = await apiRequest<CsrfResponse>('/api/auth/csrf');

  await apiRequest('/api/auth/callback/credentials', {
    method: 'POST',
    form: {
      csrfToken,
      email,
      password,
      json: 'true',
      redirect: 'false',
    },
    raw: true,
  });

  const user = await getSession();
  if (!user) {
    throw new ApiError(401, 'Invalid email or password.');
  }
  return user;
}

/** Returns the current session user, or null if unauthenticated. */
export async function getSession(): Promise<SessionUser | null> {
  const raw = await apiRequest<unknown>('/api/auth/session');
  const parsed = SessionResponse.safeParse(raw);
  if (!parsed.success) return null;
  return parsed.data.user ?? null;
}

/** Verifies a TOTP / MFA code for the active session. */
export async function verifyMfa(code: string): Promise<void> {
  await apiRequest('/api/auth/mfa/verify', {
    method: 'POST',
    json: { code },
  });
}

/** Clears the NextAuth session cookie server-side. */
export async function signOut(): Promise<void> {
  try {
    const { csrfToken } = await apiRequest<CsrfResponse>('/api/auth/csrf');
    await apiRequest('/api/auth/signout', {
      method: 'POST',
      form: { csrfToken, json: 'true' },
      raw: true,
    });
  } catch {
    // Best-effort: local state is cleared regardless.
  }
}

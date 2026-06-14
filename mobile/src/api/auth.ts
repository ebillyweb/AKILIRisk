import { apiRequest } from './client';
import { SessionUser, VerifyResponse, type SessionUser as TSessionUser } from '@/types';

/**
 * Auth surface per the mobile plan §7. The web backend may need a thin
 * `/api/auth/magic-link` + `/api/auth/verify` shape (see PLAN.md "Backend
 * follow-ups"); the client is written to that contract.
 */

/** Requests a magic-link email (and paste-code) for the given address. */
export async function requestMagicLink(email: string): Promise<void> {
  await apiRequest('/api/auth/magic-link', {
    method: 'POST',
    json: { email },
  });
}

/** Exchanges a magic-link token (from the deep link) for a session JWT. */
export async function verifyToken(token: string): Promise<VerifyResponse> {
  const raw = await apiRequest<unknown>('/api/auth/verify', {
    method: 'POST',
    json: { token },
  });
  return VerifyResponse.parse(raw);
}

/** Paste-code fallback: exchanges the 6-digit code for a session JWT. */
export async function verifyCode(email: string, code: string): Promise<VerifyResponse> {
  const raw = await apiRequest<unknown>('/api/auth/verify', {
    method: 'POST',
    json: { email, code },
  });
  return VerifyResponse.parse(raw);
}

/** Re-reads the session user with the current bearer token. */
export async function getSession(): Promise<TSessionUser | null> {
  try {
    const raw = await apiRequest<unknown>('/api/mobile/me');
    if (raw && typeof raw === 'object' && 'user' in raw) {
      const parsed = SessionUser.safeParse((raw as { user: unknown }).user);
      return parsed.success ? parsed.data : null;
    }
    const direct = SessionUser.safeParse(raw);
    return direct.success ? direct.data : null;
  } catch {
    return null;
  }
}

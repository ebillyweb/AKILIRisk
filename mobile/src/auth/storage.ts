import * as SecureStore from 'expo-secure-store';
import { SessionUser } from '@/types';

const USER_KEY = 'akilirisk.session.user';

/** Persists the last known session user for fast cold-start hydration. */
export async function saveCachedUser(user: SessionUser): Promise<void> {
  try {
    await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user));
  } catch {
    // Non-fatal; the session cookie remains the source of truth.
  }
}

export async function loadCachedUser(): Promise<SessionUser | null> {
  try {
    const raw = await SecureStore.getItemAsync(USER_KEY);
    if (!raw) return null;
    const parsed = SessionUser.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export async function clearCachedUser(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(USER_KEY);
  } catch {
    // Ignore.
  }
}

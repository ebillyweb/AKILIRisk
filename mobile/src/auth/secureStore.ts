import * as SecureStore from 'expo-secure-store';
import { SessionUser, type SessionUser as TSessionUser } from '@/types';

const TOKEN_KEY = 'akilirisk.jwt';
const USER_KEY = 'akilirisk.user';
const EMAIL_KEY = 'akilirisk.email';

/** Hardware-backed (Keychain / Keystore) credential storage, per plan §7. */
export const secureStore = {
  async setToken(token: string) {
    await SecureStore.setItemAsync(TOKEN_KEY, token, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
  },
  getToken() {
    return SecureStore.getItemAsync(TOKEN_KEY);
  },
  async setUser(user: TSessionUser) {
    await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user));
  },
  async getUser(): Promise<TSessionUser | null> {
    const raw = await SecureStore.getItemAsync(USER_KEY);
    if (!raw) return null;
    const parsed = SessionUser.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  },
  async setEmail(email: string) {
    await SecureStore.setItemAsync(EMAIL_KEY, email);
  },
  getEmail() {
    return SecureStore.getItemAsync(EMAIL_KEY);
  },
  async clear() {
    await Promise.all([
      SecureStore.deleteItemAsync(TOKEN_KEY),
      SecureStore.deleteItemAsync(USER_KEY),
    ]);
  },
};

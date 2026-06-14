import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import * as authApi from '@/api/auth';
import type { SessionUser } from '@/types';
import { clearCachedUser, loadCachedUser, saveCachedUser } from './storage';

interface AuthState {
  user: SessionUser | null;
  /** True while restoring the session on cold start. */
  initializing: boolean;
  isAuthenticated: boolean;
  /** True when MFA is enabled but not yet verified for this session. */
  needsMfa: boolean;
  signIn: (email: string, password: string) => Promise<SessionUser>;
  verifyMfa: (code: string) => Promise<void>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [initializing, setInitializing] = useState(true);

  const applyUser = useCallback(async (next: SessionUser | null) => {
    setUser(next);
    if (next) await saveCachedUser(next);
    else await clearCachedUser();
  }, []);

  const refresh = useCallback(async () => {
    const fresh = await authApi.getSession();
    await applyUser(fresh);
  }, [applyUser]);

  useEffect(() => {
    let active = true;
    (async () => {
      // Hydrate optimistically from cache, then reconcile with the server.
      const cached = await loadCachedUser();
      if (active && cached) setUser(cached);
      try {
        const fresh = await authApi.getSession();
        if (active) await applyUser(fresh);
      } catch {
        // Offline: keep the cached user (if any).
      } finally {
        if (active) setInitializing(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [applyUser]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      const next = await authApi.signIn(email, password);
      await applyUser(next);
      return next;
    },
    [applyUser],
  );

  const verifyMfa = useCallback(
    async (code: string) => {
      await authApi.verifyMfa(code);
      await refresh();
    },
    [refresh],
  );

  const signOut = useCallback(async () => {
    await authApi.signOut();
    await applyUser(null);
  }, [applyUser]);

  const value = useMemo<AuthState>(
    () => ({
      user,
      initializing,
      isAuthenticated: Boolean(user),
      needsMfa: Boolean(user?.mfaEnabled && !user?.mfaVerified),
      signIn,
      verifyMfa,
      signOut,
      refresh,
    }),
    [user, initializing, signIn, verifyMfa, signOut, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}

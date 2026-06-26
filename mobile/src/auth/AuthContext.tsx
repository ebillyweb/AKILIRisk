import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import * as authApi from '@/api/auth';
import { setAuthToken, setUnauthorizedHandler } from '@/api/client';
import type { SessionUser, VerifyResponse } from '@/types';
import { secureStore } from './secureStore';
import { isBiometricAvailable, promptBiometric } from './biometric';

type AuthStatus = 'initializing' | 'signedOut' | 'locked' | 'authenticated';

interface AuthState {
  status: AuthStatus;
  user: SessionUser | null;
  /** Last email used, prefilled on the sign-in / paste-code screens. */
  pendingEmail: string | null;
  requestMagicLink: (email: string) => Promise<void>;
  completeSignIn: (result: VerifyResponse) => Promise<void>;
  unlock: () => Promise<boolean>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('initializing');
  const [user, setUser] = useState<SessionUser | null>(null);
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const tokenRef = useRef<string | null>(null);

  // On 401 the stored session is no longer valid — drop fully to the email flow.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      void hardSignOut();
    });
    return () => setUnauthorizedHandler(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hardSignOut = useCallback(async () => {
    tokenRef.current = null;
    setAuthToken(null);
    setUser(null);
    await secureStore.clear();
    setStatus('signedOut');
  }, []);

  useEffect(() => {
    (async () => {
      const [token, cachedUser, email] = await Promise.all([
        secureStore.getToken(),
        secureStore.getUser(),
        secureStore.getEmail(),
      ]);
      if (email) setPendingEmail(email);

      if (!token || !cachedUser) {
        setStatus('signedOut');
        return;
      }
      tokenRef.current = token;
      setUser(cachedUser);
      // A stored session is gated behind biometrics on every cold start.
      const biometric = await isBiometricAvailable();
      if (biometric) {
        setStatus('locked');
      } else {
        setAuthToken(token);
        setStatus('authenticated');
      }
    })();
  }, []);

  const requestMagicLink = useCallback(async (email: string) => {
    const normalized = email.trim().toLowerCase();
    await authApi.requestMagicLink(normalized);
    await secureStore.setEmail(normalized);
    setPendingEmail(normalized);
  }, []);

  const completeSignIn = useCallback(async (result: VerifyResponse) => {
    tokenRef.current = result.token;
    setAuthToken(result.token);
    await Promise.all([
      secureStore.setToken(result.token),
      secureStore.setUser(result.user),
      secureStore.setEmail(result.user.email),
    ]);
    setUser(result.user);
    setPendingEmail(result.user.email);
    setStatus('authenticated');
  }, []);

  const unlock = useCallback(async () => {
    const ok = await promptBiometric('Unlock AkiliRisk');
    if (ok && tokenRef.current) {
      setAuthToken(tokenRef.current);
      setStatus('authenticated');
      return true;
    }
    return false;
  }, []);

  const signOut = useCallback(async () => {
    await hardSignOut();
  }, [hardSignOut]);

  const value = useMemo<AuthState>(
    () => ({
      status,
      user,
      pendingEmail,
      requestMagicLink,
      completeSignIn,
      unlock,
      signOut,
    }),
    [status, user, pendingEmail, requestMagicLink, completeSignIn, unlock, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}

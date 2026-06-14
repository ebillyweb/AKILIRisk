import Constants from 'expo-constants';

/**
 * Resolves the AkiliRisk API base URL.
 *
 * Priority:
 *  1. EXPO_PUBLIC_API_BASE_URL env var (set in .env / EAS secrets)
 *  2. `expo.extra.apiBaseUrl` in app.json
 *  3. Sensible production default
 */
function resolveApiBaseUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_BASE_URL;
  if (fromEnv && fromEnv.length > 0) return fromEnv.replace(/\/$/, '');

  const fromExtra = (Constants.expoConfig?.extra as { apiBaseUrl?: string } | undefined)
    ?.apiBaseUrl;
  if (fromExtra && fromExtra.length > 0) return fromExtra.replace(/\/$/, '');

  return 'https://app.akilirisk.com';
}

export const config = {
  apiBaseUrl: resolveApiBaseUrl(),
  /** Request timeout in milliseconds. */
  requestTimeoutMs: 20_000,
} as const;

import { isTestAuthEnabled } from "@/lib/auth/test-auth-enabled";

export type StoredPasswordResetToken = {
  rawToken: string;
  resetUrl: string;
  expires: Date;
};

const latestByEmail = new Map<string, StoredPasswordResetToken>();

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Record the latest raw reset token for test retrieval. No-op outside test auth. */
export function recordTestPasswordResetToken(
  email: string,
  token: StoredPasswordResetToken
): void {
  if (!isTestAuthEnabled()) return;
  latestByEmail.set(normalizeEmail(email), token);
}

/** Return the latest unexpired reset token captured for this email, if any. */
export function peekTestPasswordResetToken(
  email: string
): StoredPasswordResetToken | null {
  const stored = latestByEmail.get(normalizeEmail(email));
  if (!stored) return null;
  if (stored.expires.getTime() <= Date.now()) {
    latestByEmail.delete(normalizeEmail(email));
    return null;
  }
  return stored;
}

/** Test-only: clear captured tokens between unit tests. */
export function clearTestPasswordResetTokens(): void {
  latestByEmail.clear();
}

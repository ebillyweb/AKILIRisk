import "server-only";

import { headers } from "next/navigation";
import { redirect } from "next/navigation";
import type { Session } from "next-auth";

import { isMfaChallengePendingForUser } from "@/lib/auth/mfa-session-status";

export const MFA_VERIFICATION_REQUIRED_MESSAGE =
  "MFA verification required";

/**
 * Throw when MFA is enabled but the session has not completed the challenge.
 * Use in server actions and role gates that must not run pre-MFA.
 */
export async function assertMfaVerified(session: Session): Promise<void> {
  if (await isMfaChallengePendingForUser(session.user)) {
    throw new Error(MFA_VERIFICATION_REQUIRED_MESSAGE);
  }
}

/**
 * Redirect to `/mfa/verify` when the session has MFA enabled but the
 * current browser session has not completed the TOTP/recovery challenge.
 * Call from `(protected)` layouts and other authenticated server surfaces.
 */
export async function redirectIfMfaChallengePending(
  session: Session
): Promise<void> {
  if (!(await isMfaChallengePendingForUser(session.user))) {
    return;
  }

  const headerList = await headers();
  const pathname = headerList.get("x-akili-pathname") ?? "/dashboard";
  redirect(
    `/mfa/verify?callbackUrl=${encodeURIComponent(pathname)}`
  );
}

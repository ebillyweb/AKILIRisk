import "server-only";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { Session } from "next-auth";

import { isPasswordChangePending } from "@/lib/auth/password-change-gate";
import { isMfaSetupPending } from "@/lib/auth/mfa-gate";
import { isMfaChallengePendingForUser } from "@/lib/auth/mfa-session-status";

export const MFA_VERIFICATION_REQUIRED_MESSAGE =
  "MFA verification required";

export const MFA_ENROLLMENT_REQUIRED_MESSAGE =
  "MFA enrollment required";

export const PASSWORD_CHANGE_REQUIRED_MESSAGE =
  "Password update required";

/**
 * Redirect to `/change-password` when the account must update its password.
 */
export async function redirectIfPasswordChangeRequired(
  session: Session
): Promise<void> {
  if (!isPasswordChangePending(session.user)) {
    return;
  }

  const headerList = await headers();
  const pathname = headerList.get("x-akili-pathname") ?? "/dashboard";
  redirect(
    `/change-password?callbackUrl=${encodeURIComponent(pathname)}`
  );
}

/**
 * Throw when MFA is enabled but the session has not completed the challenge.
 * Use in server actions and role gates that must not run pre-MFA.
 */
export async function assertMfaVerified(session: Session): Promise<void> {
  await redirectIfPasswordChangeRequired(session);
  await redirectIfMfaEnrollmentRequired(session);

  if (await isMfaChallengePendingForUser(session.user)) {
    throw new Error(MFA_VERIFICATION_REQUIRED_MESSAGE);
  }
}

/**
 * Redirect staff (and optionally all roles) to `/mfa/setup` when MFA is
 * required but not yet enrolled.
 */
export async function redirectIfMfaEnrollmentRequired(
  session: Session
): Promise<void> {
  if (!isMfaSetupPending(session.user)) {
    return;
  }

  const headerList = await headers();
  const pathname = headerList.get("x-akili-pathname") ?? "/dashboard";
  redirect(
    `/mfa/setup?callbackUrl=${encodeURIComponent(pathname)}`
  );
}

/**
 * Redirect to `/mfa/verify` when the session has MFA enabled but the
 * current browser session has not completed the TOTP/recovery challenge.
 * Call from `(protected)` layouts and other authenticated server surfaces.
 */
export async function redirectIfMfaChallengePending(
  session: Session
): Promise<void> {
  await redirectIfPasswordChangeRequired(session);
  await redirectIfMfaEnrollmentRequired(session);

  if (!(await isMfaChallengePendingForUser(session.user))) {
    return;
  }

  const headerList = await headers();
  const pathname = headerList.get("x-akili-pathname") ?? "/dashboard";
  redirect(
    `/mfa/verify?callbackUrl=${encodeURIComponent(pathname)}`
  );
}

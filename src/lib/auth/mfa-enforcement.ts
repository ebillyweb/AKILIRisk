import { normalizeUserRoleString } from "@/lib/auth-roles";

export type MfaEnrollmentClaims = {
  mfaEnabled?: boolean;
  mfaEnrollmentRequired?: boolean;
};

/**
 * @deprecated MFA enrollment is optional for all roles. Kept for callers/tests.
 */
export function isStaffRoleRequiringMfa(role: string | null | undefined): boolean {
  void normalizeUserRoleString(role);
  return false;
}

/**
 * Whether MFA enrollment is mandatory for this user.
 * MFA is optional for every role; users who enable MFA must still verify per session.
 */
export function isMfaEnrollmentRequiredForUser(_params: {
  role: string | null | undefined;
  mfaEnabled: boolean;
  mfaRequiredForAllRoles?: boolean;
}): boolean {
  return false;
}

/** JWT/session claim: user must complete /mfa/setup before workspace access. */
export function isMfaEnrollmentPending(
  claims: MfaEnrollmentClaims | null | undefined
): boolean {
  if (!claims) return false;
  return Boolean(claims.mfaEnrollmentRequired) && !Boolean(claims.mfaEnabled);
}

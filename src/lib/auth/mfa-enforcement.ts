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

/** MFA enrollment is never mandatory — users opt in from Settings. */
export function isMfaEnrollmentPending(
  _claims: MfaEnrollmentClaims | null | undefined
): boolean {
  return false;
}

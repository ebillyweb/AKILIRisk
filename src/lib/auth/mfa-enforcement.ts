import { normalizeUserRoleString } from "@/lib/auth-roles";

export type MfaEnrollmentClaims = {
  mfaEnabled?: boolean;
  mfaEnrollmentRequired?: boolean;
};

/** Staff roles that must enroll in MFA before accessing protected routes. */
export function isStaffRoleRequiringMfa(role: string | null | undefined): boolean {
  const r = normalizeUserRoleString(role);
  return r === "ADVISOR" || r === "ADMIN" || r === "SUPER_ADMIN";
}

/**
 * Whether MFA enrollment is mandatory for this user given platform policy.
 * Pure function — safe for Edge middleware when claims are precomputed in JWT.
 */
export function isMfaEnrollmentRequiredForUser(params: {
  role: string | null | undefined;
  mfaEnabled: boolean;
  mfaRequiredForAllRoles?: boolean;
}): boolean {
  if (params.mfaEnabled) return false;

  const role = normalizeUserRoleString(params.role);
  if (isStaffRoleRequiringMfa(role)) return true;
  if (params.mfaRequiredForAllRoles && role === "USER") return true;
  return false;
}

/** JWT/session claim: user must complete /mfa/setup before workspace access. */
export function isMfaEnrollmentPending(
  claims: MfaEnrollmentClaims | null | undefined
): boolean {
  if (!claims) return false;
  return Boolean(claims.mfaEnrollmentRequired) && !Boolean(claims.mfaEnabled);
}

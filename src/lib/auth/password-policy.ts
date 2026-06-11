import { z } from "zod";

export type PasswordPolicy = {
  minLength: number;
  requireUppercase: boolean;
  requireNumber: boolean;
  revision: number;
  complianceNotice: string | null;
};

export const DEFAULT_PASSWORD_POLICY: PasswordPolicy = {
  minLength: 8,
  requireUppercase: true,
  requireNumber: true,
  revision: 1,
  complianceNotice: null,
};

/** Shared compliant password for seeds, fixtures, and docs. */
export const TEST_PASSWORD = "Testpass1";

export type PasswordValidationResult =
  | { ok: true }
  | { ok: false; error: string };

export function buildPasswordRequirementsMessage(
  policy: PasswordPolicy = DEFAULT_PASSWORD_POLICY
): string {
  const parts: string[] = [`at least ${policy.minLength} characters`];
  if (policy.requireUppercase) parts.push("one uppercase letter");
  if (policy.requireNumber) parts.push("one number");
  return `Password must include ${parts.join(", ")}.`;
}

export const PASSWORD_REQUIREMENTS_MESSAGE = buildPasswordRequirementsMessage();

/**
 * Validate a password against the active platform policy (sync, no network).
 */
export function validatePasswordComplexity(
  password: string,
  policy: PasswordPolicy = DEFAULT_PASSWORD_POLICY
): PasswordValidationResult {
  if (password.length < policy.minLength) {
    return {
      ok: false,
      error: `Password must be at least ${policy.minLength} characters`,
    };
  }
  if (policy.requireUppercase && !/[A-Z]/.test(password)) {
    return {
      ok: false,
      error: "Password must contain at least one uppercase letter",
    };
  }
  if (policy.requireNumber && !/[0-9]/.test(password)) {
    return {
      ok: false,
      error: "Password must contain at least one number",
    };
  }
  return { ok: true };
}

export function passwordMeetsPolicyRevision(
  userRevision: number | null | undefined,
  policyRevision: number
): boolean {
  return (userRevision ?? 0) >= policyRevision;
}

export function userNeedsPasswordChange(params: {
  password: string;
  passwordChangeRequired: boolean;
  passwordPolicyRevision: number | null | undefined;
  policy: PasswordPolicy;
}): boolean {
  if (params.passwordChangeRequired) return true;
  if (!validatePasswordComplexity(params.password, params.policy).ok) return true;
  return !passwordMeetsPolicyRevision(
    params.passwordPolicyRevision,
    params.policy.revision
  );
}

/** Server-side validation when setting a new password. */
export async function validatePasswordForSet(
  password: string,
  policy: PasswordPolicy = DEFAULT_PASSWORD_POLICY
): Promise<PasswordValidationResult> {
  return validatePasswordComplexity(password, policy);
}

export function passwordComplexitySchemaForPolicy(policy: PasswordPolicy) {
  let schema = z.string().min(
    policy.minLength,
    `Password must be at least ${policy.minLength} characters`
  );
  if (policy.requireUppercase) {
    schema = schema.regex(
      /[A-Z]/,
      "Password must contain at least one uppercase letter"
    );
  }
  if (policy.requireNumber) {
    schema = schema.regex(/[0-9]/, "Password must contain at least one number");
  }
  return schema;
}

/** Default-policy Zod schema for forms and routes that load policy separately. */
export const passwordComplexitySchema = passwordComplexitySchemaForPolicy(
  DEFAULT_PASSWORD_POLICY
);

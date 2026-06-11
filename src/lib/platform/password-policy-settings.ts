import "server-only";

import { prisma } from "@/lib/db";
import {
  DEFAULT_PASSWORD_POLICY,
  type PasswordPolicy,
} from "@/lib/auth/password-policy";

const PLATFORM_SETTINGS_ID = "default";

type PlatformPasswordRow = {
  passwordMinLength: number;
  passwordRequireUppercase: boolean;
  passwordRequireNumber: boolean;
  passwordPolicyRevision: number;
  passwordComplianceNotice: string | null;
};

function rowToPolicy(row: PlatformPasswordRow | null | undefined): PasswordPolicy {
  if (!row) return DEFAULT_PASSWORD_POLICY;
  return {
    minLength: row.passwordMinLength,
    requireUppercase: row.passwordRequireUppercase,
    requireNumber: row.passwordRequireNumber,
    revision: row.passwordPolicyRevision,
    complianceNotice: row.passwordComplianceNotice,
  };
}

const passwordPolicySelect = {
  passwordMinLength: true,
  passwordRequireUppercase: true,
  passwordRequireNumber: true,
  passwordPolicyRevision: true,
  passwordComplianceNotice: true,
} as const;

export async function getPasswordPolicy(): Promise<PasswordPolicy> {
  const delegate = prisma.platformSettings as
    | typeof prisma.platformSettings
    | undefined;
  if (!delegate?.findUnique) {
    return DEFAULT_PASSWORD_POLICY;
  }

  const row = await delegate.findUnique({
    where: { id: PLATFORM_SETTINGS_ID },
    select: passwordPolicySelect,
  });

  return rowToPolicy(row);
}

export type PasswordPolicyAdminData = PasswordPolicy;

export async function getPasswordPolicyForAdmin(): Promise<PasswordPolicyAdminData> {
  return getPasswordPolicy();
}

export function policyRulesChanged(
  prior: PasswordPolicy,
  next: Pick<PasswordPolicy, "minLength" | "requireUppercase" | "requireNumber">
): boolean {
  return (
    prior.minLength !== next.minLength ||
    prior.requireUppercase !== next.requireUppercase ||
    prior.requireNumber !== next.requireNumber
  );
}

export async function markStaffPasswordsOutOfCompliance(): Promise<number> {
  const result = await prisma.user.updateMany({
    where: {
      password: { not: null },
      deletedAt: null,
      role: { in: ["ADVISOR", "ADMIN", "SUPER_ADMIN"] },
    },
    data: { passwordChangeRequired: true },
  });
  return result.count;
}

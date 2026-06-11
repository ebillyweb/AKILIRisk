import "server-only";

import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { getPasswordPolicy } from "@/lib/platform/password-policy-settings";
import type { PasswordPolicy } from "@/lib/auth/password-policy";

/** Persist a newly set password and mark the account compliant with current policy. */
export async function applyPasswordUpdate(
  userId: string,
  hashedPassword: string,
  policy?: PasswordPolicy
): Promise<void> {
  const activePolicy = policy ?? (await getPasswordPolicy());
  await prisma.user.update({
    where: { id: userId },
    data: {
      password: hashedPassword,
      passwordChangeRequired: false,
      passwordPolicyRevision: activePolicy.revision,
    },
  });
}

export async function hashPasswordForStorage(plaintext: string): Promise<string> {
  return bcrypt.hash(plaintext, 12);
}

import "server-only";

import { Prisma } from "@prisma/client";

import { findUserByEmail } from "@/lib/auth/user-email";
import {
  DEFAULT_PII_POLICY,
  isEligiblePiiField,
  parsePiiPolicy,
  type EligiblePiiField,
} from "@/lib/advisor/pii-policy";
import { prisma } from "@/lib/db";

const TEST_EMAIL_SUFFIX = "@test.com";

export interface PreparePiiPolicyE2EInput {
  advisorEmail: string;
  /** Partial field map merged onto the advisor's current policy. */
  fields?: Partial<Record<EligiblePiiField, boolean>>;
  /** Reset to platform default (all fields enabled). */
  restoreDefault?: boolean;
}

export interface PreparePiiPolicyE2EResult {
  advisorEmail: string;
  advisorProfileId: string;
  restored?: boolean;
  fields?: Record<EligiblePiiField, boolean>;
}

function assertTestEmail(email: string): void {
  if (!email.endsWith(TEST_EMAIL_SUFFIX)) {
    throw new Error(
      "Test PII policy prepare is restricted to *@test.com accounts."
    );
  }
}

export async function preparePiiPolicyForE2E(
  input: PreparePiiPolicyE2EInput
): Promise<PreparePiiPolicyE2EResult> {
  const email = input.advisorEmail.trim().toLowerCase();
  assertTestEmail(email);

  const user = await findUserByEmail(email, { select: { id: true } });
  if (!user?.id) {
    throw new Error("Advisor user not found");
  }

  const profile = await prisma.advisorProfile.findUnique({
    where: { userId: user.id },
    select: { id: true, piiPolicy: true },
  });
  if (!profile) {
    throw new Error("Advisor profile not found");
  }

  if (input.restoreDefault) {
    await prisma.advisorProfile.update({
      where: { id: profile.id },
      data: {
        piiPolicy: DEFAULT_PII_POLICY as unknown as Prisma.InputJsonValue,
      },
    });
    return {
      advisorEmail: email,
      advisorProfileId: profile.id,
      restored: true,
      fields: { ...DEFAULT_PII_POLICY.fields },
    };
  }

  if (input.fields) {
    for (const key of Object.keys(input.fields)) {
      if (!isEligiblePiiField(key)) {
        throw new Error(`Unknown PII field: ${key}`);
      }
    }
    const current = parsePiiPolicy(profile.piiPolicy);
    const next = {
      schemaVersion: 1 as const,
      fields: { ...current.fields, ...input.fields },
    };
    await prisma.advisorProfile.update({
      where: { id: profile.id },
      data: { piiPolicy: next as unknown as Prisma.InputJsonValue },
    });
    return {
      advisorEmail: email,
      advisorProfileId: profile.id,
      fields: next.fields,
    };
  }

  throw new Error("Specify fields or restoreDefault.");
}

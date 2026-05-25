import "server-only";

import { Prisma } from "@prisma/client";

import { findUserByEmail } from "@/lib/auth/user-email";
import {
  ELIGIBLE_PII_FIELDS,
  isEligiblePiiField,
  type EligiblePiiField,
} from "@/lib/advisor/pii-policy";
import { prisma } from "@/lib/db";

const TEST_EMAIL_SUFFIX = "@test.com";

export interface PrepareConsentE2EInput {
  clientEmail: string;
  /** Seed null fieldVisibility so the consent gate fires. */
  resetPending?: boolean;
  /** Restore a concrete visibility map (all fields No) so the gate is satisfied. */
  restoreConsented?: boolean;
  /** Set an explicit visibility map (non-null); merges over all-false defaults. */
  setFieldVisibility?: Partial<Record<EligiblePiiField, boolean>>;
}

export interface PrepareConsentE2EResult {
  clientEmail: string;
  assignmentIds: string[];
  resetPending?: boolean;
  restored?: boolean;
  fieldVisibility?: Record<string, boolean>;
}

function assertTestEmail(email: string): void {
  if (!email.endsWith(TEST_EMAIL_SUFFIX)) {
    throw new Error("Test consent prepare is restricted to *@test.com accounts.");
  }
}

/** Build an all-false visibility map — matches a client who clicked
 *  Continue without opting in to any field. */
function allDeclinedVisibility(): Record<string, boolean> {
  const map: Record<string, boolean> = {};
  for (const field of ELIGIBLE_PII_FIELDS) {
    map[field] = false;
  }
  return map;
}

export async function prepareConsentForE2E(
  input: PrepareConsentE2EInput
): Promise<PrepareConsentE2EResult> {
  const email = input.clientEmail.trim().toLowerCase();
  assertTestEmail(email);

  const user = await findUserByEmail(email, { select: { id: true } });
  if (!user?.id) {
    throw new Error("User not found");
  }

  const assignments = await prisma.clientAdvisorAssignment.findMany({
    where: { clientId: user.id, status: "ACTIVE" },
    select: { id: true },
  });

  if (assignments.length === 0) {
    throw new Error("No ACTIVE client assignments found for test user.");
  }

  const assignmentIds = assignments.map((a) => a.id);

  if (input.resetPending) {
    await prisma.clientAdvisorAssignment.updateMany({
      where: { id: { in: assignmentIds } },
      data: { fieldVisibility: Prisma.DbNull },
    });
    return { clientEmail: email, assignmentIds, resetPending: true };
  }

  if (input.restoreConsented) {
    const visibility = allDeclinedVisibility();
    await prisma.clientAdvisorAssignment.updateMany({
      where: { id: { in: assignmentIds } },
      data: {
        fieldVisibility: visibility as unknown as Prisma.InputJsonValue,
      },
    });
    return { clientEmail: email, assignmentIds, restored: true };
  }

  if (input.setFieldVisibility) {
    for (const key of Object.keys(input.setFieldVisibility)) {
      if (!isEligiblePiiField(key)) {
        throw new Error(`Unknown PII field: ${key}`);
      }
    }
    const visibility = {
      ...allDeclinedVisibility(),
      ...input.setFieldVisibility,
    };
    await prisma.clientAdvisorAssignment.updateMany({
      where: { id: { in: assignmentIds } },
      data: {
        fieldVisibility: visibility as unknown as Prisma.InputJsonValue,
      },
    });
    return {
      clientEmail: email,
      assignmentIds,
      fieldVisibility: visibility,
    };
  }

  throw new Error(
    "Specify resetPending, restoreConsented, or setFieldVisibility."
  );
}

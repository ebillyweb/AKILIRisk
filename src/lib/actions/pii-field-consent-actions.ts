"use server";

/**
 * Option D session 2.1 — incremental YES when a client fills an optional
 * PII field on /settings or /profiles. Never sets NO; use
 * `recordConsentDecision` for explicit Yes/No on the consent modal or
 * settings revisit form.
 */

import { Prisma } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { AUDIT_ACTIONS, writeAudit } from "@/lib/audit/audit-log";
import {
  parseAssignmentFieldVisibility,
  resolveEffectiveFieldVisibility,
} from "@/lib/advisor/field-visibility";
import {
  ELIGIBLE_PII_FIELDS,
  isEligiblePiiField,
  parsePiiPolicy,
  type EligiblePiiField,
} from "@/lib/advisor/pii-policy";

export type RecordPiiFieldConsentResult =
  | { ok: true; granted: boolean }
  | { ok: false; code: string; message: string };

export interface RecordPiiFieldConsentInput {
  field: EligiblePiiField;
  /** Required when the client has multiple ACTIVE advisor assignments. */
  assignmentId?: string;
}

export async function recordPiiFieldConsent(
  input: RecordPiiFieldConsentInput
): Promise<RecordPiiFieldConsentResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, code: "unauthenticated", message: "Not signed in." };
  }
  if (!isEligiblePiiField(input.field)) {
    return {
      ok: false,
      code: "invalid_field",
      message: `Unknown PII field: ${input.field}`,
    };
  }

  const assignment = input.assignmentId
    ? await prisma.clientAdvisorAssignment.findUnique({
        where: { id: input.assignmentId },
        select: {
          id: true,
          clientId: true,
          advisorId: true,
          status: true,
          fieldVisibility: true,
          advisor: { select: { piiPolicy: true } },
        },
      })
    : await prisma.clientAdvisorAssignment.findFirst({
        where: { clientId: session.user.id, status: "ACTIVE" },
        orderBy: { assignedAt: "asc" },
        select: {
          id: true,
          clientId: true,
          advisorId: true,
          status: true,
          fieldVisibility: true,
          advisor: { select: { piiPolicy: true } },
        },
      });

  if (!assignment || assignment.clientId !== session.user.id) {
    return { ok: false, code: "not_found", message: "Assignment not found." };
  }
  if (assignment.status !== "ACTIVE") {
    return {
      ok: false,
      code: "not_active",
      message: "This assignment is no longer active.",
    };
  }

  const advisorPolicy = parsePiiPolicy(assignment.advisor.piiPolicy);
  if (!advisorPolicy.fields[input.field]) {
    return {
      ok: false,
      code: "policy_disabled",
      message: "Your advisor does not collect this field.",
    };
  }

  const priorMap = parseAssignmentFieldVisibility(assignment.fieldVisibility);
  if (priorMap[input.field]) {
    return { ok: true, granted: true };
  }

  const nextMap = { ...priorMap, [input.field]: true };
  await prisma.clientAdvisorAssignment.update({
    where: { id: assignment.id },
    data: {
      fieldVisibility: nextMap as unknown as Prisma.InputJsonValue,
    },
  });

  void writeAudit({
    actor: {
      userId: session.user.id,
      role: session.user.role ?? null,
      email: session.user.email ?? null,
    },
    action: AUDIT_ACTIONS.CLIENT_PII_FIELD_CONSENT,
    entityType: "ClientAdvisorAssignment",
    entityId: assignment.id,
    metadata: {
      field: input.field,
      granted: true,
      advisorProfileId: assignment.advisorId,
      surface: "field_fill",
    },
  });

  // Sanity: effective visibility must now include the field.
  const effective = resolveEffectiveFieldVisibility(
    advisorPolicy,
    nextMap
  );
  if (!effective[input.field]) {
    return {
      ok: false,
      code: "policy_disabled",
      message: "Your advisor does not collect this field.",
    };
  }

  return { ok: true, granted: true };
}

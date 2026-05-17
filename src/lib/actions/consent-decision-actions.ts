"use server";

/**
 * Option D session 2.2 (BRD §5.1 amendment) — record the client's
 * per-field Yes/No decisions on the /consent/pending modal.
 *
 * Flow:
 *
 *   1. Auth as the assignment's CLIENT (the `clientId` on the
 *      assignment row must match the session user — defense against
 *      a probing caller trying to set someone else's visibility).
 *   2. Validate every submitted field key against ELIGIBLE_PII_FIELDS.
 *   3. Defensively drop fields the advisor's CURRENT policy disables.
 *      Even a "yes" for a disabled field doesn't grant visibility.
 *   4. Persist the resulting visibility map onto the assignment.
 *   5. Emit one CLIENT_PII_INTAKE_CONSENT audit row per *decision*
 *      (both Yes and No are audited; the audit metadata.granted flag
 *      distinguishes them).
 *
 * Distinct from session 2.1's `recordPiiFieldConsent`:
 *
 *   • `recordPiiFieldConsent` (2.1) flips only YES from /settings or
 *     /profiles when the client fills a value. Never sets NO.
 *   • This action (2.2) flips BOTH YES and NO — it's the explicit
 *     consent decision surface, not a side-effect of form-fill.
 *
 * Idempotent: a submit whose values match the assignment's current
 * visibility writes no audit rows (but does still write the JSON to
 * flip null → concrete, which is the whole point of this surface).
 */

import { Prisma } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { AUDIT_ACTIONS, writeAudit } from "@/lib/audit/audit-log";
import {
  ELIGIBLE_PII_FIELDS,
  isEligiblePiiField,
  parsePiiPolicy,
  type EligiblePiiField,
} from "@/lib/advisor/pii-policy";

export type RecordConsentDecisionResult =
  | { ok: true; updated: number }
  | { ok: false; code: string; message: string };

export interface RecordConsentDecisionInput {
  assignmentId: string;
  /** Map of field → user's Y/N for that field. Keys must be drawn
   *  from ELIGIBLE_PII_FIELDS; unknown keys → `invalid_field`.
   *  Fields omitted from the submission default to false (a "skip"
   *  on the modal is treated as a No — the client must explicitly
   *  opt in). */
  decisions: Partial<Record<EligiblePiiField, boolean>>;
}

export async function recordConsentDecision(
  input: RecordConsentDecisionInput
): Promise<RecordConsentDecisionResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, code: "unauthenticated", message: "Not signed in." };
  }

  // Validate keys before any DB read.
  for (const key of Object.keys(input.decisions ?? {})) {
    if (!isEligiblePiiField(key)) {
      return {
        ok: false,
        code: "invalid_field",
        message: `Unknown PII field: ${key}`,
      };
    }
  }

  const assignment = await prisma.clientAdvisorAssignment.findUnique({
    where: { id: input.assignmentId },
    select: {
      id: true,
      clientId: true,
      advisorId: true,
      status: true,
      fieldVisibility: true,
      advisor: { select: { piiPolicy: true } },
    },
  });
  if (!assignment) {
    return { ok: false, code: "not_found", message: "Assignment not found." };
  }
  if (assignment.clientId !== session.user.id) {
    // Opaque error — don't reveal whether the assignment exists.
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
  const submitted = input.decisions ?? {};

  // Compose the new visibility. Every eligible field defaults to false
  // (the safer floor); the submission can flip individual fields to
  // true. Defense-in-depth: a "yes" for a field the advisor's policy
  // disables still resolves to false.
  const next: Record<string, boolean> = {};
  const decisions: Array<{ field: EligiblePiiField; granted: boolean }> = [];
  for (const field of ELIGIBLE_PII_FIELDS) {
    if (!advisorPolicy.fields[field]) {
      next[field] = false;
      // Don't record an audit row for advisor-disabled fields — the
      // client didn't make a real decision; the field wasn't on the
      // prompt.
      continue;
    }
    const submittedValue = submitted[field];
    const granted = submittedValue === true;
    next[field] = granted;
    decisions.push({ field, granted });
  }

  // Snapshot prior visibility BEFORE the update — the audit
  // idempotency check below needs the pre-write state. Capturing
  // post-update would race against in-memory mutation in test mocks
  // (and is semantically wrong against real Prisma anyway).
  const prior =
    assignment.fieldVisibility &&
    typeof assignment.fieldVisibility === "object" &&
    !Array.isArray(assignment.fieldVisibility)
      ? { ...(assignment.fieldVisibility as Record<string, unknown>) }
      : {};

  // Persist the new visibility regardless of audit-row count — the
  // entire purpose of this action is to flip null → concrete. A
  // subsequent revisit will see non-null fieldVisibility and the
  // dashboard gate will let it through.
  await prisma.clientAdvisorAssignment.update({
    where: { id: assignment.id },
    data: {
      fieldVisibility: next as unknown as Prisma.InputJsonValue,
    },
  });

  // Audit each decision (Yes and No) on fields the advisor IS
  // collecting. Idempotency check: skip a row when the new value
  // equals the prior visibility (covers the "revisit with same
  // answers" case).

  for (const { field, granted } of decisions) {
    const priorValue = typeof prior[field] === "boolean" ? prior[field] : null;
    if (priorValue === granted) continue; // idempotent
    void writeAudit({
      actor: {
        userId: session.user.id,
        role: session.user.role ?? null,
        email: session.user.email ?? null,
      },
      action: AUDIT_ACTIONS.CLIENT_PII_INTAKE_CONSENT,
      entityType: "ClientAdvisorAssignment",
      entityId: assignment.id,
      metadata: {
        field,
        granted,
        advisorProfileId: assignment.advisorId,
        surface: "consent_modal",
      },
    });
  }

  return { ok: true, updated: decisions.length };
}

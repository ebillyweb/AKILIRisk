"use server";

/**
 * Option D session 1 commit 1.3 (BRD §5.1 amendment) — server action
 * driving the /advisor/settings/pii-policy form.
 *
 * Behavior:
 *
 *   • Computes the diff between the advisor's current `piiPolicy` and
 *     the submitted toggle set.
 *   • Persists the new policy (preserving schemaVersion).
 *   • Emits one PII_POLICY_FIELD_ENABLE/DISABLE audit row per field
 *     that flipped.
 *   • Emits one PII_POLICY_UPDATE summary row capturing the full
 *     before/after policy.
 *   • Idempotent: a submit with no actual changes is a no-op (no DB
 *     write, no audit rows). The `updated` count in the result tells
 *     the caller how many fields actually flipped.
 *
 * Visibility-snapshot semantics — out of scope for this commit:
 *
 *   The action does NOT propagate the new policy onto existing
 *   `ClientAdvisorAssignment.fieldVisibility` rows. Existing assignments
 *   keep their snapshotted visibility — that's the intentional Option D
 *   behavior so a policy change doesn't retroactively hide data already
 *   collected from existing clients. Session 2's intake-form work wires
 *   the new policy into NEW assignment-create paths.
 */

import { Prisma } from "@prisma/client";
import { requireAdvisorRole, getAdvisorProfileOrThrow } from "@/lib/advisor/auth";
import { prisma } from "@/lib/db";
import { AUDIT_ACTIONS, writeAudit } from "@/lib/audit/audit-log";
import {
  ELIGIBLE_PII_FIELDS,
  isEligiblePiiField,
  parsePiiPolicy,
  type EligiblePiiField,
  type PiiPolicy,
} from "@/lib/advisor/pii-policy";

export type PiiPolicyActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; code: string; message: string };

export interface UpdatePiiPolicyInput {
  /** Partial map of field → desired boolean. Keys must be drawn from
   *  ELIGIBLE_PII_FIELDS; unknown keys cause an `invalid_field` rejection.
   *  Fields omitted from the input retain their current value. */
  fields: Partial<Record<EligiblePiiField, boolean>>;
}

export async function updatePiiPolicy(
  input: UpdatePiiPolicyInput
): Promise<PiiPolicyActionResult<{ updated: number; policy: PiiPolicy }>> {
  // 1. Auth: advisor (or admin acting via advisor portal).
  const session = await requireAdvisorRole();
  if (session.role !== "ADVISOR") {
    return {
      ok: false,
      code: "forbidden",
      message: "Only advisors can edit their PII policy.",
    };
  }
  const profile = await getAdvisorProfileOrThrow(session.userId);

  // 2. Validate field keys before any write.
  const submitted = input.fields ?? {};
  for (const key of Object.keys(submitted)) {
    if (!isEligiblePiiField(key)) {
      return {
        ok: false,
        code: "invalid_field",
        message: `Unknown PII field: ${key}`,
      };
    }
  }

  // 3. Read current policy + compute the diff.
  const before = parsePiiPolicy(profile.piiPolicy);
  const after: PiiPolicy = {
    schemaVersion: 1,
    fields: { ...before.fields },
  };
  const flips: Array<{ field: EligiblePiiField; from: boolean; to: boolean }> = [];

  for (const field of ELIGIBLE_PII_FIELDS) {
    const submittedValue = submitted[field];
    if (typeof submittedValue !== "boolean") continue; // omitted = unchanged
    if (submittedValue !== before.fields[field]) {
      after.fields[field] = submittedValue;
      flips.push({
        field,
        from: before.fields[field],
        to: submittedValue,
      });
    }
  }

  // 4. Idempotent fast-path: nothing changed → no DB write, no audit rows.
  if (flips.length === 0) {
    return { ok: true, data: { updated: 0, policy: before } };
  }

  // 5. Persist. JSONB column; cast for Prisma's input typing.
  await prisma.advisorProfile.update({
    where: { id: profile.id },
    data: {
      piiPolicy: after as unknown as Prisma.InputJsonValue,
    },
  });

  // 6. Audit. Per-field rows for forensic granularity + a summary row
  //    for "what was the policy on date X" queries. All fire-and-forget
  //    via writeAudit's swallow-errors contract.
  for (const flip of flips) {
    void writeAudit({
      actor: {
        userId: session.userId,
        role: session.role,
        email: session.email,
      },
      action: flip.to
        ? AUDIT_ACTIONS.PII_POLICY_FIELD_ENABLE
        : AUDIT_ACTIONS.PII_POLICY_FIELD_DISABLE,
      entityType: "AdvisorProfile",
      entityId: profile.id,
      metadata: { field: flip.field },
    });
  }
  void writeAudit({
    actor: {
      userId: session.userId,
      role: session.role,
      email: session.email,
    },
    action: AUDIT_ACTIONS.PII_POLICY_UPDATE,
    entityType: "AdvisorProfile",
    entityId: profile.id,
    beforeData: before,
    afterData: after,
    metadata: { changedFieldCount: flips.length },
  });

  return { ok: true, data: { updated: flips.length, policy: after } };
}

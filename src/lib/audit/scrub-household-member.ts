import "server-only";

/**
 * BRD §5.1 explicitly excludes household-member PII from the platform's
 * data model. Reality drifted (we DO store names, ages, occupations, phones,
 * emails on HouseholdMember rows — see prisma/schema.prisma:HouseholdMember
 * and the BRD gap analysis from round 7), but we don't have to extend that
 * leak into the audit log.
 *
 * Use `scrubHouseholdMember(member)` at every household-member writeAudit
 * call site to strip the sensitive fields BEFORE the payload reaches
 * `redactForAudit`. The default redactor preserves names because they're
 * useful when auditing User/AdvisorProfile rows; this helper applies the
 * stricter household-member policy explicitly at the four call sites that
 * need it (see src/lib/actions/profile-actions.ts).
 *
 * Honored regardless of `shareNameAndContactWithAdvisor`: admins reading the
 * audit log don't get to bypass the share flag. The shared `redacted: true`
 * sentinel preserves the field's existence in the diff (so a delete
 * payload still shows there WAS a fullName, age, etc.) without exposing
 * the value.
 */
export type HouseholdMemberAuditView = {
  /** The actual id is fine to log — it's a cuid, no PII. */
  id?: string;
  fullName: { redacted: true };
  age: { redacted: true };
  occupation: { redacted: true };
  phone: { redacted: true };
  email: { redacted: true };
  /** Relationship category and governance roles ARE useful for audit and
   *  not personally identifying ("a SPOUSE was added", not "Jane Smith"). */
  relationship?: string | null;
  governanceRoles?: string[] | null;
  isResident?: boolean | null;
  shareNameAndContactWithAdvisor?: boolean | null;
};

const PII_FIELDS = ["fullName", "age", "occupation", "phone", "email"] as const;

/**
 * Build the audit-safe view of a HouseholdMember row. Pass the result as
 * `beforeData` or `afterData` to writeAudit — the redactor will then run
 * over it and pass the already-scrubbed PII fields through unchanged
 * (they're objects, not the matching key shapes the redactor catches).
 *
 * Accepts a partial because some call sites only have a subset (toggle
 * actions don't fetch the full row).
 */
export function scrubHouseholdMember(
  member: Record<string, unknown> | null | undefined
): HouseholdMemberAuditView | null {
  if (!member) return null;

  const out: HouseholdMemberAuditView = {
    fullName: { redacted: true },
    age: { redacted: true },
    occupation: { redacted: true },
    phone: { redacted: true },
    email: { redacted: true },
  };

  if (typeof member.id === "string") out.id = member.id;
  if (typeof member.relationship === "string") out.relationship = member.relationship;
  if (Array.isArray(member.governanceRoles)) {
    out.governanceRoles = member.governanceRoles.filter(
      (r): r is string => typeof r === "string"
    );
  }
  if (typeof member.isResident === "boolean") out.isResident = member.isResident;
  if (typeof member.shareNameAndContactWithAdvisor === "boolean") {
    out.shareNameAndContactWithAdvisor = member.shareNameAndContactWithAdvisor;
  }

  // Defensive assertion: if any PII field accidentally leaks through (e.g.
  // a future schema change adds another sensitive column), the type system
  // doesn't catch it but a runtime caller might. Drop the field outright.
  for (const k of PII_FIELDS) {
    if (k in member) {
      // Ensure the redactor sees our sentinel, not whatever the source had.
      (out as Record<string, unknown>)[k] = { redacted: true };
    }
  }

  return out;
}

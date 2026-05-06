import "server-only";

/**
 * Round-11 commit 2.2 (BRD §5.1 amendment): household-member audit
 * view simplification.
 *
 * Pre-round-11 this helper redacted the PII columns (fullName, age,
 * occupation, phone, email) on a HouseholdMember row before they
 * reached writeAudit, since those columns shouldn't ever appear in
 * audit-log entries. Round-11 dropped those columns entirely from the
 * schema, so the scrub work is now trivial — the helper passes through
 * the demographic + relationship fields that ARE safe to log.
 *
 * Kept as a function (rather than inlining the field projection at
 * every call site) so:
 *   1. The "what gets logged for a household member" policy stays
 *      explicit and centrally-locatable in code review.
 *   2. If a future schema change re-introduces a sensitive column,
 *      there's an obvious chokepoint to add the redaction back in.
 *
 * Existing audit rows written pre-round-11 captured `{ redacted: true }`
 * sentinels for the dropped columns; the unified-view UI displays
 * those literally and they remain readable as historical artifacts.
 */
export type HouseholdMemberAuditView = {
  id?: string;
  displayLabel?: string | null;
  birthYear?: number | null;
  sex?: string | null;
  relationship?: string | null;
  governanceRoles?: string[] | null;
  isResident?: boolean | null;
};

/**
 * Build the audit-safe view of a HouseholdMember row. Pass the result
 * as `beforeData` or `afterData` to writeAudit. Accepts a partial
 * because some call sites only have a subset (toggle actions don't
 * fetch the full row).
 */
export function scrubHouseholdMember(
  member: Record<string, unknown> | null | undefined
): HouseholdMemberAuditView | null {
  if (!member) return null;

  const out: HouseholdMemberAuditView = {};
  if (typeof member.id === "string") out.id = member.id;
  if (typeof member.displayLabel === "string") out.displayLabel = member.displayLabel;
  if (typeof member.birthYear === "number") out.birthYear = member.birthYear;
  else if (member.birthYear === null) out.birthYear = null;
  if (typeof member.sex === "string" || member.sex === null) {
    out.sex = (member.sex ?? null) as string | null;
  }
  if (typeof member.relationship === "string") out.relationship = member.relationship;
  if (Array.isArray(member.governanceRoles)) {
    out.governanceRoles = member.governanceRoles.filter(
      (r): r is string => typeof r === "string"
    );
  }
  if (typeof member.isResident === "boolean") out.isResident = member.isResident;

  return out;
}

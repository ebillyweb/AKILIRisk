/**
 * Option D session 1 commit 1.3 (BRD §5.1 amendment) — shared types +
 * the eligible-field allowlist for advisor-configured PII policy.
 *
 * The 5 eligible fields are the columns gated by `AdvisorProfile.piiPolicy`.
 * The allowlist lives here (not inside the action) so:
 *
 *   • The server action and the client form import the same source of
 *     truth — typos in the form's field names fail at compile time.
 *   • Future read-side enforcement (intake routes, advisor dashboard,
 *     export bundle) can re-import the same constant.
 *   • Schema validation rejects unknown keys without re-listing them.
 */

export const ELIGIBLE_PII_FIELDS = [
  "User.name",
  "ClientProfile.phone",
  "HouseholdMember.fullName",
  "HouseholdMember.phone",
  "HouseholdMember.notes",
] as const;

export type EligiblePiiField = (typeof ELIGIBLE_PII_FIELDS)[number];

/** Schema-versioned policy shape persisted on `AdvisorProfile.piiPolicy`. */
export interface PiiPolicy {
  schemaVersion: 1;
  fields: Record<EligiblePiiField, boolean>;
}

/** Default policy shape: every field ON (opt-out per round-12 sign-off).
 *  Mirrors the JSONB DEFAULT in migration 20260523120000_pii_policy. */
export const DEFAULT_PII_POLICY: PiiPolicy = {
  schemaVersion: 1,
  fields: {
    "User.name": true,
    "ClientProfile.phone": true,
    "HouseholdMember.fullName": true,
    "HouseholdMember.phone": true,
    "HouseholdMember.notes": true,
  },
};

/** Type guard: returns true if `key` is one of the 5 eligible fields. */
export function isEligiblePiiField(key: string): key is EligiblePiiField {
  return (ELIGIBLE_PII_FIELDS as readonly string[]).includes(key);
}

/** Read a `Json` value (whatever Prisma returned) into a typed PiiPolicy.
 *  Forgiving: any missing key defaults to `true` (matches the DEFAULT
 *  policy shape) so a partial JSONB doesn't lose existing toggles.
 *  Throws on completely-malformed input (non-object). */
export function parsePiiPolicy(raw: unknown): PiiPolicy {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("piiPolicy: malformed JSON (expected object)");
  }
  const obj = raw as { schemaVersion?: unknown; fields?: unknown };
  const fields: Record<EligiblePiiField, boolean> = {
    ...DEFAULT_PII_POLICY.fields,
  };
  if (obj.fields && typeof obj.fields === "object" && !Array.isArray(obj.fields)) {
    for (const key of ELIGIBLE_PII_FIELDS) {
      const v = (obj.fields as Record<string, unknown>)[key];
      if (typeof v === "boolean") fields[key] = v;
    }
  }
  return { schemaVersion: 1, fields };
}

/** User-facing display copy for each eligible field. Centralized so the
 *  settings form, future audit-log readouts, and the admin observability
 *  surface all render identical labels. */
export const PII_FIELD_LABELS: Record<
  EligiblePiiField,
  { label: string; description: string }
> = {
  "User.name": {
    label: "Client name",
    description:
      "Allows clients to provide their full legal name. Without this, clients are referred to by email only.",
  },
  "ClientProfile.phone": {
    label: "Client phone",
    description:
      "Allows clients to provide a phone number for advisor contact.",
  },
  "HouseholdMember.fullName": {
    label: "Household member full name",
    description:
      "Allows clients to provide household members' full names instead of just “Member A”, “Member B” labels.",
  },
  "HouseholdMember.phone": {
    label: "Household member phone",
    description:
      "Allows clients to provide household members' phone numbers.",
  },
  "HouseholdMember.notes": {
    label: "Household member notes",
    description:
      "Allows free-form notes per household member (e.g. role context, health considerations).",
  },
};

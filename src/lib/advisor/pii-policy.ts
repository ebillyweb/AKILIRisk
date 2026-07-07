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
  /** When true, workspace UI shows Client CL-… references for every client. */
  pseudonymousWorkspaceLabeling: boolean;
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
  pseudonymousWorkspaceLabeling: false,
};

export const WORKSPACE_CLIENT_LABELING_COPY = {
  sectionTitle: "Workspace client labeling",
  sectionDescription:
    "How every client appears in your pipeline and detail views. Sign-in delivery is managed separately in Client sign-in.",
  email: {
    label: "Email address",
    description:
      "Show each client's sign-in email in pipeline and detail views (or their legal name when on file).",
  },
  clientId: {
    label: "Client reference",
    description:
      "Show Client CL-… for every client (e.g. CL-8F3K-29QX). Names and emails are hidden in your workspace—you map each reference outside Akili.",
  },
} as const;

export const ENTERPRISE_CLIENT_DATA_POLICY_COPY = {
  sectionTitle: "Client data policy",
  sectionDescription:
    "Set firm defaults for how team members label clients and which intake fields they collect. Owners and administrators can still choose their own policy.",
  workspaceLabeling: {
    email: {
      label: "Email address (firm default)",
      description:
        "Team members show sign-in email (or legal name when on file) for every client.",
    },
    clientId: {
      label: "Client reference (firm default)",
      description:
        "Team members show Client CL-… for every client. Names and emails stay out of the advisor workspace.",
    },
  },
  collectLegalName: {
    label: "Collect client legal name (firm default)",
    description:
      "When enabled, team members may ask new clients for a legal name during intake.",
  },
  lock: {
    label: "Lock client data policy for team members",
    description:
      "ADVISOR-role members follow these firm defaults. Firm owners and administrators keep full control.",
  },
} as const;

export const PIPELINE_SEARCH_COPY = {
  standard: {
    placeholder: "Search by name or email…",
    ariaLabel: "Search clients by name or email",
  },
  pseudonymous: {
    placeholder: "Search by client reference…",
    ariaLabel: "Search clients by client reference",
  },
} as const;

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
  const obj = raw as {
    schemaVersion?: unknown;
    fields?: unknown;
    pseudonymousWorkspaceLabeling?: unknown;
  };
  const fields: Record<EligiblePiiField, boolean> = {
    ...DEFAULT_PII_POLICY.fields,
  };
  if (obj.fields && typeof obj.fields === "object" && !Array.isArray(obj.fields)) {
    for (const key of ELIGIBLE_PII_FIELDS) {
      const v = (obj.fields as Record<string, unknown>)[key];
      if (typeof v === "boolean") fields[key] = v;
    }
  }

  let pseudonymousWorkspaceLabeling = DEFAULT_PII_POLICY.pseudonymousWorkspaceLabeling;
  if (typeof obj.pseudonymousWorkspaceLabeling === "boolean") {
    pseudonymousWorkspaceLabeling = obj.pseudonymousWorkspaceLabeling;
  } else if (fields["User.name"] === false) {
    // Legacy: advisors who disabled legal-name collection before the
    // dedicated workspace toggle existed.
    pseudonymousWorkspaceLabeling = true;
  }

  return { schemaVersion: 1, fields, pseudonymousWorkspaceLabeling };
}

/** Shown in settings and client detail when pseudonymous labeling is active. */
export const PSEUDONYMOUS_CLIENT_LABELING_NOTE =
  "Every client appears as Client CL-… in your pipeline and detail views. You maintain who each reference maps to outside Akili. Sign-in delivery uses the address in Client sign-in only—it is not shown elsewhere in your workspace.";

/** User-facing display copy for each eligible field. Centralized so the
 *  settings form, future audit-log readouts, and the admin observability
 *  surface all render identical labels. */
export const PII_FIELD_LABELS: Record<
  EligiblePiiField,
  { label: string; description: string }
> = {
  "User.name": {
    label: "Collect client legal name",
    description:
      "When enabled, clients may provide a legal name during intake and optional profile details.",
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

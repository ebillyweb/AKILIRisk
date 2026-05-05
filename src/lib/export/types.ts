/**
 * Data-export types — round-10 / E2 (BRD §5.3 data ownership + portability).
 *
 * The export bundle is a ZIP that contains the same data in two formats:
 *   - csv/<table>.csv per Prisma model (one row per record)
 *   - data.json with a single nested structure (advisor → clients → ...)
 *
 * Plus metadata.json (file index, row counts, schema version) and README.md
 * (the BRD §5.3 promise + a human-readable index).
 *
 * Schema versioning: bump on any column add/remove. Consumers can dispatch
 * on `metadata.schemaVersion`.
 */

/** Bumped on column add/remove. Stored in metadata.json. */
export const EXPORT_SCHEMA_VERSION = "v1" as const;

/** ZIP byte-cap enforced inline on the stream. Exceeding it aborts mid-stream
 *  with a 413 (set in the route) and writes `aborted: true` into the audit
 *  row. Picked at 50 MB per the E2 design — sized for realistic per-tenant
 *  metadata-only volumes. System-wide exports of large platforms may hit
 *  this cap; the hint in the response steers operators toward the
 *  not-yet-built async path. */
export const EXPORT_BYTE_CAP = 50 * 1024 * 1024;

/** What the route is asked to dump. */
export type ExportScope =
  | { kind: "tenant"; advisorProfileId: string }
  | { kind: "system" };

/** Counts written into metadata.json. Keys are `csv/<file>.csv` minus the
 *  `csv/` prefix and `.csv` suffix, so consumers can correlate. */
export type RowCounts = Record<string, number>;

export interface ExportMetadata {
  schemaVersion: typeof EXPORT_SCHEMA_VERSION;
  generatedAt: string; // ISO8601
  scope: "tenant" | "system";
  /** Set on tenant exports; omitted on system. */
  advisor?: {
    advisorProfileId: string;
    userId: string;
    email: string;
    firmName: string | null;
    brandName: string | null;
  };
  /** Set on system exports: one entry per tenant included. */
  tenants?: Array<{
    advisorProfileId: string;
    userId: string;
    email: string;
    firmName: string | null;
    rowCounts: RowCounts;
  }>;
  /** Aggregate row counts (across all tenants for a system export). */
  rowCounts: RowCounts;
  /** Approximate uncompressed payload bytes (best-effort during stream). */
  approximateBytes?: number;
  /** If the route aborted mid-stream because the cap was hit, this is set
   *  on the audit-log metadata for the export action — NOT inside the bundle
   *  itself (an aborted bundle never gets metadata.json written). Documented
   *  here so the field name is canonical. */
}

/** What a tenant fetch returns. Shape mirrors the Prisma models 1:1.
 *  Type intentionally uses Record<string, unknown> arrays so the serializers
 *  don't depend on the Prisma client types — the queries layer is the only
 *  place that knows about Prisma; everything downstream sees plain rows. */
export interface TenantBundle {
  advisor: Record<string, unknown> | null;
  advisorSubdomain: Record<string, unknown> | null;
  clients: Record<string, unknown>[];
  clientProfiles: Record<string, unknown>[];
  subscriptions: Record<string, unknown>[];
  clientAdvisorAssignments: Record<string, unknown>[];
  inviteCodes: Record<string, unknown>[];
  householdMembers: Record<string, unknown>[];
  intakeInterviews: Record<string, unknown>[];
  intakeResponses: Record<string, unknown>[];
  intakeApprovals: Record<string, unknown>[];
  assessments: Record<string, unknown>[];
  assessmentResponses: Record<string, unknown>[];
  pillarScores: Record<string, unknown>[];
  documentRequirements: Record<string, unknown>[];
  advisorNotifications: Record<string, unknown>[];
  governanceReviewLeads: Record<string, unknown>[];
  notificationPreferences: Record<string, unknown>[];
  /** Heap-merged across the three audit tables, filtered to this tenant. */
  auditLog: Record<string, unknown>[];
}

/** Logical names of the CSVs inside the bundle. The serializer + reader
 *  both index into this so adding a new table requires editing one place. */
export const TENANT_CSV_FILES = [
  "advisor",
  "advisor_subdomain",
  "clients",
  "client_profiles",
  "subscriptions",
  "client_advisor_assignments",
  "invite_codes",
  "household_members",
  "intake_interviews",
  "intake_responses",
  "intake_approvals",
  "assessments",
  "assessment_responses",
  "pillar_scores",
  "document_requirements",
  "advisor_notifications",
  "governance_review_leads",
  "notification_preferences",
  "audit_log",
] as const;

export type TenantCsvFile = (typeof TENANT_CSV_FILES)[number];

/** Map TenantBundle field → CSV file name. Single source of truth used by
 *  both the CSV serializer and the bundle composer. */
export const TENANT_BUNDLE_KEY_TO_CSV: Record<keyof TenantBundle, TenantCsvFile> = {
  advisor: "advisor",
  advisorSubdomain: "advisor_subdomain",
  clients: "clients",
  clientProfiles: "client_profiles",
  subscriptions: "subscriptions",
  clientAdvisorAssignments: "client_advisor_assignments",
  inviteCodes: "invite_codes",
  householdMembers: "household_members",
  intakeInterviews: "intake_interviews",
  intakeResponses: "intake_responses",
  intakeApprovals: "intake_approvals",
  assessments: "assessments",
  assessmentResponses: "assessment_responses",
  pillarScores: "pillar_scores",
  documentRequirements: "document_requirements",
  advisorNotifications: "advisor_notifications",
  governanceReviewLeads: "governance_review_leads",
  notificationPreferences: "notification_preferences",
  auditLog: "audit_log",
};

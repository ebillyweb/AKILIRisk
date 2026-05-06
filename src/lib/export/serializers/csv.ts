/**
 * CSV serializer for the data export bundle (E2 / BRD §5.3).
 *
 * Per-table column maps are defined here; the bundle composer iterates them
 * to produce one CSV per Prisma model. Empty input arrays still emit a
 * header line so downstream parsers can introspect the schema even for
 * empty tables.
 *
 * RFC-4180 escaping is intentionally duplicated from the audit-log export
 * (`src/app/api/admin/audit-log/export/route.ts`) per the E2 sign-off:
 * one-line helper, duplication beats coupling the two routes.
 */

import type { TenantBundle } from "../types";

/**
 * RFC-4180 CSV escape: wrap any field containing a quote, comma, or
 * newline in double quotes; double embedded quotes. Anything else passes
 * through unchanged. Sufficient for our payload columns which serialize
 * JSON via JSON.stringify (no raw newlines).
 */
export function csvEscape(value: string): string {
  if (value === "") return "";
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/** Convert a single value to its CSV cell representation. Dates → ISO,
 *  null/undefined → empty, objects/arrays → JSON.stringify. */
export function toCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
}

/** Render one row given a column order. */
export function rowToCsv(row: Record<string, unknown>, columns: readonly string[]): string {
  return columns.map((c) => csvEscape(toCell(row[c]))).join(",");
}

/** Render a full CSV (header + rows). Always emits the header even when
 *  rows is empty so consumers see the schema. */
export function tableToCsv(
  rows: Record<string, unknown>[],
  columns: readonly string[]
): string {
  const header = columns.join(",");
  if (rows.length === 0) return header + "\n";
  const body = rows.map((r) => rowToCsv(r, columns)).join("\n");
  return header + "\n" + body + "\n";
}

/**
 * Per-table column maps. Order matters — it's the column order in the
 * emitted CSV. Sourced from prisma/schema.prisma and kept in sync manually
 * (the schema-version bump in metadata.json signals when the contract
 * changes).
 *
 * PII handling: per the E2 sign-off these export RAW values. The
 * BRD §5.3 contract is that the customer/tenant owns the data and the
 * export exists to fulfill that ownership; redacting the raw bundle would
 * defeat the point. The audit log inside the bundle is the redacted
 * version that already exists; the user/profile/intake tables are
 * unredacted source.
 */
export const COLUMNS_BY_TABLE = {
  advisor: [
    "id", "userId", "specializations", "licenseNumber", "firmName", "bio",
    "phone", "jobTitle", "logoUrl", "brandName", "tagline", "primaryColor",
    "secondaryColor", "accentColor", "websiteUrl", "emailFooterText",
    "supportEmail", "supportPhone", "logoS3Key", "logoContentType",
    "logoFileSize", "logoUploadedAt", "brandingEnabled", "customDomainEnabled",
    "createdAt", "updatedAt",
  ],
  advisor_subdomain: [
    "id", "advisorProfileId", "subdomain", "isActive", "dnsVerified",
    "dnsVerifiedAt", "createdAt", "updatedAt",
  ],
  clients: [
    "id", "email", "emailVerified", "name", "firstName", "lastName", "image",
    "role", "mfaEnabled", "advisorPortalAccessEnabled", "deletedAt",
    "createdAt", "updatedAt",
    // password + mfaSecret + mfaRecoveryCodes intentionally OMITTED — those
    // are credential material, not "client data" under §5.3, and exporting
    // them would let the bundle compromise the account.
  ],
  // Round-11 commit 2.1 (BRD §5.1 amendment): contact + address + DOB
  // columns dropped. The CSV is now id + userId + timestamps; kept in
  // the bundle so SAR exports still document the table's existence and
  // its row count for each client.
  client_profiles: [
    "id", "userId", "createdAt", "updatedAt",
  ],
  subscriptions: [
    "id", "userId", "stripeCustomerId", "stripePriceId", "stripeSubscriptionId",
    "tier", "status", "clientLimit", "billingCycle", "currentPeriodEnd",
    "cancelAtPeriodEnd", "basicBrandingEnabled", "advancedBrandingEnabled",
    "customSubdomainEnabled", "whiteLabel", "lastStripeEventAt",
    "createdAt", "updatedAt",
  ],
  client_advisor_assignments: [
    "id", "clientId", "advisorId", "assignedAt", "status",
    "intakeWaivedAt", "intakeWaivedByAdvisorId",
  ],
  invite_codes: [
    "id", "code", "advisorProfileId", "email", "tier", "billingCycle",
    "usedByUserId", "usedAt", "expiresAt", "createdAt",
  ],
  // Round-11 commit 2.2 (BRD §5.1 amendment): demographic-only export.
  // fullName / age / occupation / phone / email / notes /
  // shareNameAndContactWithAdvisor were dropped from the schema; the
  // export now ships displayLabel + birthYear + sex alongside the
  // structural fields (relationship, governanceRoles, isResident).
  household_members: [
    "id", "userId", "displayLabel", "birthYear", "sex",
    "relationship", "governanceRoles", "isResident",
    "createdAt", "updatedAt",
  ],
  intake_interviews: [
    "id", "userId", "status", "currentQuestionIndex", "startedAt",
    "completedAt", "submittedAt", "updatedAt",
  ],
  intake_responses: [
    "id", "interviewId", "questionId", "audioUrl", "audioS3Key",
    "audioContentType", "audioDuration", "transcription", "transcriptionStatus",
    "answeredAt", "updatedAt",
  ],
  intake_approvals: [
    "id", "interviewId", "advisorId", "status", "focusAreas", "notes",
    "reviewedAt", "approvedAt", "createdAt", "updatedAt",
  ],
  assessments: [
    "id", "userId", "version", "status", "currentPillar", "currentQuestionIndex",
    "startedAt", "completedAt", "updatedAt", "approvalId",
  ],
  assessment_responses: [
    "id", "assessmentId", "questionId", "pillar", "subCategory", "answer",
    "skipped", "answeredAt", "updatedAt",
  ],
  pillar_scores: [
    "id", "assessmentId", "pillar", "score", "riskLevel", "breakdown",
    "missingControls", "calculatedAt",
  ],
  document_requirements: [
    "id", "advisorId", "clientId", "name", "description", "required",
    "fulfilled", "fulfilledAt", "fileKey", "fileName", "fileSize",
    "createdAt", "updatedAt",
  ],
  advisor_notifications: [
    "id", "advisorId", "type", "title", "message", "referenceId", "read",
    "createdAt",
  ],
  governance_review_leads: [
    "id", "fullName", "email", "phone", "city", "state", "country",
    "familyComplexity", "primaryConcern", "assignedAdvisorId", "createdAt",
    "updatedAt",
  ],
  notification_preferences: [
    "id", "userId", "emailNewIntake", "emailIntakeUpdated", "emailNewLead",
    "emailSystem", "createdAt", "updatedAt",
  ],
  audit_log: [
    "id", "createdAt", "actorUserId", "actorRole", "actorEmailHash", "action",
    "entityType", "entityId", "beforeData", "afterData", "metadata",
    "ipAddress", "userAgent",
  ],
} as const satisfies Record<string, readonly string[]>;

/** Type-safe column lookup. */
export type CsvTableName = keyof typeof COLUMNS_BY_TABLE;

/** Render every CSV from a TenantBundle. Returns a Record keyed by CSV
 *  filename (e.g. "clients") → CSV string. The composer in bundle.ts
 *  iterates this. */
export function renderTenantCsvs(bundle: TenantBundle): Record<CsvTableName, string> {
  const adv = bundle.advisor ? [bundle.advisor] : [];
  const sub = bundle.advisorSubdomain ? [bundle.advisorSubdomain] : [];
  return {
    advisor: tableToCsv(adv, COLUMNS_BY_TABLE.advisor),
    advisor_subdomain: tableToCsv(sub, COLUMNS_BY_TABLE.advisor_subdomain),
    clients: tableToCsv(bundle.clients, COLUMNS_BY_TABLE.clients),
    client_profiles: tableToCsv(bundle.clientProfiles, COLUMNS_BY_TABLE.client_profiles),
    subscriptions: tableToCsv(bundle.subscriptions, COLUMNS_BY_TABLE.subscriptions),
    client_advisor_assignments: tableToCsv(
      bundle.clientAdvisorAssignments,
      COLUMNS_BY_TABLE.client_advisor_assignments
    ),
    invite_codes: tableToCsv(bundle.inviteCodes, COLUMNS_BY_TABLE.invite_codes),
    household_members: tableToCsv(bundle.householdMembers, COLUMNS_BY_TABLE.household_members),
    intake_interviews: tableToCsv(bundle.intakeInterviews, COLUMNS_BY_TABLE.intake_interviews),
    intake_responses: tableToCsv(bundle.intakeResponses, COLUMNS_BY_TABLE.intake_responses),
    intake_approvals: tableToCsv(bundle.intakeApprovals, COLUMNS_BY_TABLE.intake_approvals),
    assessments: tableToCsv(bundle.assessments, COLUMNS_BY_TABLE.assessments),
    assessment_responses: tableToCsv(bundle.assessmentResponses, COLUMNS_BY_TABLE.assessment_responses),
    pillar_scores: tableToCsv(bundle.pillarScores, COLUMNS_BY_TABLE.pillar_scores),
    document_requirements: tableToCsv(bundle.documentRequirements, COLUMNS_BY_TABLE.document_requirements),
    advisor_notifications: tableToCsv(bundle.advisorNotifications, COLUMNS_BY_TABLE.advisor_notifications),
    governance_review_leads: tableToCsv(bundle.governanceReviewLeads, COLUMNS_BY_TABLE.governance_review_leads),
    notification_preferences: tableToCsv(bundle.notificationPreferences, COLUMNS_BY_TABLE.notification_preferences),
    audit_log: tableToCsv(bundle.auditLog, COLUMNS_BY_TABLE.audit_log),
  };
}

/** Compute row counts (CSV name → number of data rows, excluding header). */
export function rowCountsForBundle(bundle: TenantBundle): Record<CsvTableName, number> {
  return {
    advisor: bundle.advisor ? 1 : 0,
    advisor_subdomain: bundle.advisorSubdomain ? 1 : 0,
    clients: bundle.clients.length,
    client_profiles: bundle.clientProfiles.length,
    subscriptions: bundle.subscriptions.length,
    client_advisor_assignments: bundle.clientAdvisorAssignments.length,
    invite_codes: bundle.inviteCodes.length,
    household_members: bundle.householdMembers.length,
    intake_interviews: bundle.intakeInterviews.length,
    intake_responses: bundle.intakeResponses.length,
    intake_approvals: bundle.intakeApprovals.length,
    assessments: bundle.assessments.length,
    assessment_responses: bundle.assessmentResponses.length,
    pillar_scores: bundle.pillarScores.length,
    document_requirements: bundle.documentRequirements.length,
    advisor_notifications: bundle.advisorNotifications.length,
    governance_review_leads: bundle.governanceReviewLeads.length,
    notification_preferences: bundle.notificationPreferences.length,
    audit_log: bundle.auditLog.length,
  };
}

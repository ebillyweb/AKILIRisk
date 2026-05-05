/**
 * Nested JSON serializer for the data export bundle (E2 / BRD §5.3).
 *
 * The flat CSVs are the canonical artifacts (one file per Prisma model);
 * this nested JSON is for consumers that want hierarchy and don't want to
 * reconstruct the joins themselves.
 *
 * Top-level shape (tenant scope):
 *   {
 *     schemaVersion: "v1",
 *     advisor: {...AdvisorProfile, subdomain, notifications, leads,
 *                inviteCodes },
 *     clients: [
 *       { user: {...User},
 *         clientProfile, subscription, notificationPreference,
 *         assignment: {...ClientAdvisorAssignment},
 *         householdMembers: [...],
 *         intake: { interview, responses, approval },
 *         assessments: [{ assessment, responses, scores }],
 *         documentRequirements: [...] }
 *     ],
 *     auditLog: [...]   // tenant-scoped, heap-merged
 *   }
 *
 * Critical invariant: every foreign-key reference in the nested JSON must
 * resolve into the same nested tree (no dangling clientId, no assessment
 * referencing a missing pillar score, etc.). The serializer rebuilds these
 * references from the flat TenantBundle and the test in
 * `serializers/json.test.ts` asserts referential integrity.
 */

import type { TenantBundle } from "../types";
import { EXPORT_SCHEMA_VERSION } from "../types";

/** Pull rows by foreign-key match. Defensive: coerces missing FKs to []. */
function rowsBy<T extends Record<string, unknown>>(
  rows: T[],
  key: keyof T,
  value: unknown
): T[] {
  return rows.filter((r) => r[key] === value);
}

function rowOrNull<T extends Record<string, unknown>>(
  rows: T[],
  key: keyof T,
  value: unknown
): T | null {
  return rows.find((r) => r[key] === value) ?? null;
}

export interface NestedClientNode {
  user: Record<string, unknown>;
  clientProfile: Record<string, unknown> | null;
  subscription: Record<string, unknown> | null;
  notificationPreference: Record<string, unknown> | null;
  assignment: Record<string, unknown> | null;
  householdMembers: Record<string, unknown>[];
  intake: {
    interview: Record<string, unknown>;
    responses: Record<string, unknown>[];
    approval: Record<string, unknown> | null;
  } | null;
  assessments: Array<{
    assessment: Record<string, unknown>;
    responses: Record<string, unknown>[];
    scores: Record<string, unknown>[];
  }>;
  documentRequirements: Record<string, unknown>[];
}

export interface NestedTenantExport {
  schemaVersion: typeof EXPORT_SCHEMA_VERSION;
  advisor: {
    profile: Record<string, unknown> | null;
    subdomain: Record<string, unknown> | null;
    notifications: Record<string, unknown>[];
    inviteCodes: Record<string, unknown>[];
    governanceReviewLeads: Record<string, unknown>[];
  };
  clients: NestedClientNode[];
  auditLog: Record<string, unknown>[];
}

/** Build the nested view of a tenant bundle. Pure function over the
 *  bundle — no DB calls, no I/O. */
export function buildNestedTenantExport(bundle: TenantBundle): NestedTenantExport {
  const advisorProfileId = (bundle.advisor?.id as string | undefined) ?? null;

  const clients: NestedClientNode[] = bundle.clients.map((user) => {
    const userId = user.id as string;

    // Intake interview (max 1 in practice; if multiple, take the latest by
    // updatedAt — the schema doesn't enforce uniqueness but the workflow does)
    const interviews = rowsBy(bundle.intakeInterviews, "userId", userId).sort((a, b) => {
      const aT = new Date((a.updatedAt as string | Date) ?? 0).getTime();
      const bT = new Date((b.updatedAt as string | Date) ?? 0).getTime();
      return bT - aT;
    });
    const interview = interviews[0] ?? null;
    const intakeResponses = interview
      ? rowsBy(bundle.intakeResponses, "interviewId", interview.id)
      : [];
    const intakeApproval = interview
      ? rowOrNull(bundle.intakeApprovals, "interviewId", interview.id)
      : null;

    // Assessments: nest responses + scores per assessment.
    const userAssessments = rowsBy(bundle.assessments, "userId", userId);
    const assessments = userAssessments.map((assessment) => ({
      assessment,
      responses: rowsBy(bundle.assessmentResponses, "assessmentId", assessment.id),
      scores: rowsBy(bundle.pillarScores, "assessmentId", assessment.id),
    }));

    // Document requirements: this client's row, scoped to the tenant advisor.
    const docs = bundle.documentRequirements.filter(
      (d) =>
        d.clientId === userId &&
        (advisorProfileId == null || d.advisorId === advisorProfileId)
    );

    return {
      user,
      clientProfile: rowOrNull(bundle.clientProfiles, "userId", userId),
      subscription: rowOrNull(bundle.subscriptions, "userId", userId),
      notificationPreference: rowOrNull(bundle.notificationPreferences, "userId", userId),
      assignment: bundle.clientAdvisorAssignments.find(
        (a) =>
          a.clientId === userId &&
          (advisorProfileId == null || a.advisorId === advisorProfileId)
      ) ?? null,
      householdMembers: rowsBy(bundle.householdMembers, "userId", userId),
      intake: interview
        ? { interview, responses: intakeResponses, approval: intakeApproval }
        : null,
      assessments,
      documentRequirements: docs,
    };
  });

  return {
    schemaVersion: EXPORT_SCHEMA_VERSION,
    advisor: {
      profile: bundle.advisor,
      subdomain: bundle.advisorSubdomain,
      notifications: bundle.advisorNotifications,
      inviteCodes: bundle.inviteCodes,
      governanceReviewLeads: bundle.governanceReviewLeads,
    },
    clients,
    auditLog: bundle.auditLog,
  };
}

/** Serialize the nested view to a JSON string with stable indentation.
 *  Bytes are appended to the bundle stream verbatim. */
export function serializeNestedJson(nested: NestedTenantExport): string {
  return JSON.stringify(nested, null, 2);
}

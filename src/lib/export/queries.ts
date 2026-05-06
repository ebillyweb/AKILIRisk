import "server-only";

/**
 * Tenant- and system-scoped data fetchers for the export bundle (E2 / BRD §5.3).
 *
 * SECURITY-CRITICAL: every query that returns client-owned rows MUST hinge
 * on the `client_advisor_assignments` table. We never fetch client rows by
 * id without proving the assignment chain. The vitest test in
 * `queries.test.ts` seeds two advisors and asserts tenant A's bundle
 * contains zero rows from tenant B — that's the regression that catches
 * future cross-tenant leak bugs.
 *
 * Implementation strategy: one tenant fetch resolves the (advisorProfileId
 * → set of clientUserIds) mapping up-front, then every other query is
 * scoped to that set. No nested loops, no per-client roundtrips.
 */

import { prisma } from "@/lib/db";
import type { TenantBundle } from "./types";
import {
  fetchTenantAuditLog,
  type TenantEntityIds,
} from "./audit-merge";

/** Resolve the advisor's userId + the set of client userIds assigned to
 *  this advisor (regardless of assignment status — we want historical
 *  records too, including INACTIVE assignments). Returns null if the
 *  advisor profile doesn't exist (caller maps to 404). */
export async function resolveTenantScope(advisorProfileId: string): Promise<{
  advisorProfileId: string;
  advisorUserId: string;
  clientUserIds: string[];
} | null> {
  const advisor = await prisma.advisorProfile.findUnique({
    where: { id: advisorProfileId },
    select: { id: true, userId: true },
  });
  if (!advisor) return null;

  const assignments = await prisma.clientAdvisorAssignment.findMany({
    where: { advisorId: advisorProfileId },
    select: { clientId: true },
  });
  const clientUserIds = Array.from(new Set(assignments.map((a) => a.clientId)));

  return {
    advisorProfileId: advisor.id,
    advisorUserId: advisor.userId,
    clientUserIds,
  };
}

/**
 * Fetch every Prisma row that belongs to one tenant. The advisor's own
 * row + every client row reachable through ClientAdvisorAssignment.
 *
 * Does NOT include global config tables (AssessmentBankQuestion,
 * PillarCategory, ScoringRule, etc.) — those are platform metadata, not
 * client data under §5.3. They live in the `global-config/` folder of the
 * system-wide export only.
 */
export async function fetchTenantBundle(
  scope: NonNullable<Awaited<ReturnType<typeof resolveTenantScope>>>
): Promise<TenantBundle> {
  const { advisorProfileId, advisorUserId, clientUserIds } = scope;

  // The two id sets used by every per-tenant query below.
  const allUserIds = [advisorUserId, ...clientUserIds];
  const clientUserIdSet = new Set(clientUserIds);

  // Run independent queries in parallel. Each is bounded by either
  // advisorProfileId or one of the user-id sets.
  const [
    advisorProfile,
    advisorSubdomain,
    clientUsers,
    clientProfiles,
    subscriptions,
    assignments,
    inviteCodes,
    householdMembers,
    intakeInterviews,
    intakeApprovals,
    assessments,
    docs,
    notifications,
    governanceLeads,
    notificationPrefs,
  ] = await Promise.all([
    prisma.advisorProfile.findUnique({ where: { id: advisorProfileId } }),
    prisma.advisorSubdomain.findUnique({ where: { advisorId: advisorProfileId } }),
    prisma.user.findMany({
      where: { id: { in: clientUserIds } },
    }),
    prisma.clientProfile.findMany({ where: { userId: { in: clientUserIds } } }),
    prisma.subscription.findMany({ where: { userId: { in: allUserIds } } }),
    prisma.clientAdvisorAssignment.findMany({ where: { advisorId: advisorProfileId } }),
    prisma.inviteCode.findMany({ where: { createdBy: advisorProfileId } }),
    prisma.householdMember.findMany({ where: { userId: { in: clientUserIds } } }),
    prisma.intakeInterview.findMany({ where: { userId: { in: clientUserIds } } }),
    prisma.intakeApproval.findMany({ where: { advisorId: advisorProfileId } }),
    prisma.assessment.findMany({ where: { userId: { in: clientUserIds } } }),
    prisma.documentRequirement.findMany({
      where: {
        // Document-requirement rows have BOTH advisorId and clientId.
        // Belt-and-braces: advisor scope AND client must be in our
        // assignment set. Belt: filter by advisorId so we only see rows
        // this advisor created. Braces: filter by clientId so a future bug
        // where someone wrote a row with the wrong advisorId can't leak
        // another tenant's clients.
        advisorId: advisorProfileId,
        clientId: { in: clientUserIds },
      },
    }),
    prisma.advisorNotification.findMany({ where: { advisorId: advisorProfileId } }),
    prisma.governanceReviewLead.findMany({
      where: { assignedAdvisorId: advisorProfileId },
    }),
    prisma.notificationPreference.findMany({ where: { userId: { in: allUserIds } } }),
  ]);

  // Second wave: queries that depend on the first wave's ids.
  const interviewIds = intakeInterviews.map((i) => i.id);
  const assessmentIds = assessments.map((a) => a.id);

  const [intakeResponses, assessmentResponses, pillarScores] = await Promise.all([
    prisma.intakeResponse.findMany({ where: { interviewId: { in: interviewIds } } }),
    prisma.assessmentResponse.findMany({ where: { assessmentId: { in: assessmentIds } } }),
    prisma.pillarScore.findMany({ where: { assessmentId: { in: assessmentIds } } }),
  ]);

  // Audit log: heap-merge across the three audit tables, filtered to this
  // tenant's actor user ids and entity ids.
  const tenantEntityIds: TenantEntityIds = {
    userIds: new Set(allUserIds),
    advisorProfileIds: new Set([advisorProfileId]),
    subscriptionIds: new Set(subscriptions.map((s) => s.id)),
    assessmentIds: new Set(assessmentIds),
    interviewIds: new Set(interviewIds),
    inviteCodeIds: new Set(inviteCodes.map((i) => i.id)),
    documentRequirementIds: new Set(docs.map((d) => d.id)),
    householdMemberIds: new Set(householdMembers.map((h) => h.id)),
  };
  const auditLog = await fetchTenantAuditLog(tenantEntityIds);

  // Defensive belt: re-filter clientUsers by the assignment set we resolved
  // first. Should be a no-op (the IN-clause query is already scoped) but
  // catches the case where the same query runs across a transaction
  // boundary that adds an unrelated user.
  const clients = clientUsers.filter((u) => clientUserIdSet.has(u.id));

  return {
    advisor: advisorProfile as Record<string, unknown> | null,
    advisorSubdomain: advisorSubdomain as Record<string, unknown> | null,
    clients: clients as Record<string, unknown>[],
    clientProfiles: clientProfiles as Record<string, unknown>[],
    subscriptions: subscriptions as Record<string, unknown>[],
    clientAdvisorAssignments: assignments as Record<string, unknown>[],
    inviteCodes: inviteCodes as Record<string, unknown>[],
    householdMembers: householdMembers as Record<string, unknown>[],
    intakeInterviews: intakeInterviews as Record<string, unknown>[],
    intakeResponses: intakeResponses as Record<string, unknown>[],
    intakeApprovals: intakeApprovals as Record<string, unknown>[],
    assessments: assessments as Record<string, unknown>[],
    assessmentResponses: assessmentResponses as Record<string, unknown>[],
    pillarScores: pillarScores as Record<string, unknown>[],
    documentRequirements: docs as Record<string, unknown>[],
    advisorNotifications: notifications as Record<string, unknown>[],
    governanceReviewLeads: governanceLeads as Record<string, unknown>[],
    notificationPreferences: notificationPrefs as Record<string, unknown>[],
    auditLog: auditLog as unknown as Record<string, unknown>[],
  };
}

/** List every advisor profile (active or not) for the system-wide export.
 *  Iterating tenants serially is the documented pattern (per E2 design)
 *  to keep memory bounded — fan-out would multiply the per-tenant peak. */
export async function listAdvisorProfilesForSystemExport(): Promise<
  Array<{ id: string; userId: string; email: string; firmName: string | null; brandName: string | null }>
> {
  const profiles = await prisma.advisorProfile.findMany({
    select: {
      id: true,
      userId: true,
      firmName: true,
      brandName: true,
      user: { select: { email: true } },
    },
    orderBy: { createdAt: "asc" },
  });
  return profiles.map((p) => ({
    id: p.id,
    userId: p.userId,
    email: p.user.email,
    firmName: p.firmName,
    brandName: p.brandName,
  }));
}

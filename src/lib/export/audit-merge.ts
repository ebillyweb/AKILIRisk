import "server-only";

/**
 * Tenant-scoped heap merge across the three audit tables for the data
 * export bundle (E2 / BRD §5.3).
 *
 * Mirrors `src/lib/audit/queries.ts:streamAuditLog` (round-8 unified read
 * view) but with a different filter shape: instead of UI-driven filters
 * (action, actorUserId, dates), this filter is the set of user ids and
 * entity ids that belong to the tenant. A row is in-tenant iff:
 *   - actorUserId is one of the tenant's user ids (advisor + clients), OR
 *   - entityId is one of the tenant's entity ids (subscription, assessment,
 *     interview, invite, document, household member id), OR
 *   - the legacy table's tenant FK matches.
 *
 * The output shape is the projected/unified row (same columns as the
 * generic AuditLog table) so the CSV serializer can render every source
 * with the same column map.
 */

import { prisma } from "@/lib/db";
import {
  genericAuditRowToUnified,
  subscriptionAuditRowToGeneric,
  brandingAuditRowToGeneric,
  type UnifiedAuditRow,
} from "@/lib/audit/adapters";

/** Set of every entity id reachable from a tenant. Built once per export
 *  in `queries.ts:fetchTenantBundle` and passed in. */
export interface TenantEntityIds {
  /** advisor.userId + every client userId. */
  userIds: Set<string>;
  /** AdvisorProfile.id (typically a single-element set). */
  advisorProfileIds: Set<string>;
  subscriptionIds: Set<string>;
  assessmentIds: Set<string>;
  interviewIds: Set<string>;
  inviteCodeIds: Set<string>;
  documentRequirementIds: Set<string>;
  householdMemberIds: Set<string>;
}

/**
 * Fetch every audit row that belongs to this tenant across all three
 * audit tables, projected into the unified shape (UnifiedAuditRow).
 *
 * Bounded by tenant size, not by total audit-log size — a 100-client
 * tenant with a year of activity is realistically a few thousand rows.
 * Materialized into memory; the bundle composer needs the full sorted
 * list to write a CSV. (For the audit-log export route the sort happens
 * one-row-at-a-time via the heap merge; here we sort once at the end.)
 */
export async function fetchTenantAuditLog(
  tenant: TenantEntityIds
): Promise<UnifiedAuditRow[]> {
  const userIdArr = Array.from(tenant.userIds);
  const advisorProfileIdArr = Array.from(tenant.advisorProfileIds);
  const subscriptionIdArr = Array.from(tenant.subscriptionIds);

  // Generic AuditLog: any row whose actor is in the tenant, OR whose
  // entityId is in any of the tenant's entity-id sets. Using OR with all
  // sets in one query so Postgres can run it as a single index seek per
  // member of the OR (and we don't care about the precise plan — a few
  // hundred rows is the realistic cap).
  const entityIdArr = [
    ...tenant.subscriptionIds,
    ...tenant.assessmentIds,
    ...tenant.interviewIds,
    ...tenant.inviteCodeIds,
    ...tenant.documentRequirementIds,
    ...tenant.householdMemberIds,
    ...tenant.advisorProfileIds,
    ...tenant.userIds,
  ];

  const [generic, subscription, branding] = await Promise.all([
    prisma.auditLog.findMany({
      where: {
        OR: [
          ...(userIdArr.length > 0 ? [{ actorUserId: { in: userIdArr } }] : []),
          ...(entityIdArr.length > 0 ? [{ entityId: { in: entityIdArr } }] : []),
        ],
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    }),
    // SubscriptionAuditLog is FK-cascaded to Subscription.id. Filter to
    // subscriptions owned by anyone in the tenant.
    subscriptionIdArr.length > 0
      ? prisma.subscriptionAuditLog.findMany({
          where: { subscriptionId: { in: subscriptionIdArr } },
          orderBy: [{ timestamp: "desc" }, { id: "desc" }],
        })
      : Promise.resolve([] as unknown as Awaited<ReturnType<typeof prisma.subscriptionAuditLog.findMany>>),
    // AdvisorBrandingAuditLog has both userId (actor) and advisorId (FK).
    advisorProfileIdArr.length > 0 || userIdArr.length > 0
      ? prisma.advisorBrandingAuditLog.findMany({
          where: {
            OR: [
              ...(advisorProfileIdArr.length > 0
                ? [{ advisorId: { in: advisorProfileIdArr } }]
                : []),
              ...(userIdArr.length > 0 ? [{ userId: { in: userIdArr } }] : []),
            ],
          },
          orderBy: [{ timestamp: "desc" }, { id: "desc" }],
        })
      : Promise.resolve([] as unknown as Awaited<ReturnType<typeof prisma.advisorBrandingAuditLog.findMany>>),
  ]);

  const unified: UnifiedAuditRow[] = [
    ...generic.map(genericAuditRowToUnified),
    ...subscription.map(subscriptionAuditRowToGeneric),
    ...branding.map(brandingAuditRowToGeneric),
  ];

  // Sort DESC by createdAt (then id for deterministic order on equal
  // timestamps). Single in-memory sort; the row count is bounded.
  unified.sort((a, b) => {
    const t = b.createdAt.getTime() - a.createdAt.getTime();
    if (t !== 0) return t;
    return b.id.localeCompare(a.id);
  });

  return unified;
}

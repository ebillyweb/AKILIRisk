import "server-only";

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  brandingAuditRowToGeneric,
  denamespaceBrandingAction,
  denamespaceSubscriptionAction,
  genericAuditRowToUnified,
  subscriptionAuditRowToGeneric,
  type UnifiedAuditRow,
} from "@/lib/audit/adapters";

/**
 * Filter shape for the admin audit-log page and CSV export.
 *
 * Round-8: reads now span three tables (generic AuditLog + two legacy:
 * SubscriptionAuditLog, AdvisorBrandingAuditLog). The filter shape is
 * unchanged from round-7; routing to per-source queries happens internally.
 *
 * `from` / `to` default to "last 7 days" at the call site, not here.
 */
export interface AuditLogFilter {
  /** Exact actor user id. Null/undefined matches any actor.
   *  Note: SubscriptionAuditLog has no actor — when this is set, the
   *  subscription source is excluded entirely. */
  actorUserId?: string | null;
  /** Namespaced action strings (any of). Empty array == match any.
   *  Action prefix routes the query to its source:
   *    - `subscription.*` → SubscriptionAuditLog only
   *    - `branding.*`     → AdvisorBrandingAuditLog only
   *    - anything else    → generic AuditLog only */
  actions?: string[];
  /** Exact entity type. `"Subscription"` / `"AdvisorBranding"` route to the
   *  legacy tables; anything else routes to AuditLog. Empty hits all three. */
  entityType?: string | null;
  /** Exact entity id (only meaningful with entityType). */
  entityId?: string | null;
  from?: Date | null;
  to?: Date | null;
}

export interface AuditLogPagination {
  /** Offset-based pagination. Round-7 used cursor pagination on a single
   *  table; round-8's merge-across-sources is simpler with offset/limit at
   *  the page sizes the audit log operates at (≤ 200/page, low traffic). */
  offset?: number;
  /** Default 50, capped to 200 to bound payload size. */
  take?: number;
}

const DEFAULT_TAKE = 50;
const MAX_TAKE = 200;

// ── Routing — decide which sources a filter touches ─────────────────────

interface SourceRouting {
  generic: boolean;
  subscription: boolean;
  branding: boolean;
}

function routeFilter(filter: AuditLogFilter): SourceRouting {
  const route: SourceRouting = { generic: true, subscription: true, branding: true };

  // entityType: hard-routes to a single source.
  if (filter.entityType === "Subscription") {
    route.generic = false;
    route.branding = false;
  } else if (filter.entityType === "AdvisorBranding") {
    route.generic = false;
    route.subscription = false;
  } else if (filter.entityType) {
    // Any other entityType is a generic value — legacy tables can't match.
    route.subscription = false;
    route.branding = false;
  }

  // actorUserId: SubscriptionAuditLog has no actor column. Filtering by
  // any specific actor excludes the subscription source.
  if (filter.actorUserId) {
    route.subscription = false;
  }

  // actions: namespace prefix routes by source. If ALL filtered actions are
  // in one namespace, exclude the others.
  if (filter.actions && filter.actions.length > 0) {
    const hasGeneric = filter.actions.some(
      (a) => !a.startsWith("subscription.") && !a.startsWith("branding.")
    );
    const hasSub = filter.actions.some((a) => a.startsWith("subscription."));
    const hasBrand = filter.actions.some((a) => a.startsWith("branding."));
    route.generic = route.generic && hasGeneric;
    route.subscription = route.subscription && hasSub;
    route.branding = route.branding && hasBrand;
  }

  return route;
}

// ── Per-source where builders ────────────────────────────────────────────

function genericWhere(filter: AuditLogFilter): Prisma.AuditLogWhereInput {
  const where: Prisma.AuditLogWhereInput = {};
  if (filter.actorUserId) where.actorUserId = filter.actorUserId;
  if (filter.actions && filter.actions.length > 0) {
    const generic = filter.actions.filter(
      (a) => !a.startsWith("subscription.") && !a.startsWith("branding.")
    );
    if (generic.length > 0) where.action = { in: generic };
  }
  if (filter.entityType && filter.entityType !== "Subscription" && filter.entityType !== "AdvisorBranding") {
    where.entityType = filter.entityType;
  }
  if (filter.entityId) where.entityId = filter.entityId;
  if (filter.from || filter.to) {
    where.createdAt = {};
    if (filter.from) where.createdAt.gte = filter.from;
    if (filter.to) where.createdAt.lte = filter.to;
  }
  return where;
}

function subscriptionWhere(
  filter: AuditLogFilter
): Prisma.SubscriptionAuditLogWhereInput {
  const where: Prisma.SubscriptionAuditLogWhereInput = {};
  if (filter.actions && filter.actions.length > 0) {
    const subActions = filter.actions
      .map(denamespaceSubscriptionAction)
      .filter((a): a is string => typeof a === "string");
    if (subActions.length > 0) where.action = { in: subActions };
  }
  if (filter.entityId && filter.entityType === "Subscription") {
    where.subscriptionId = filter.entityId;
  }
  if (filter.from || filter.to) {
    where.timestamp = {};
    if (filter.from) where.timestamp.gte = filter.from;
    if (filter.to) where.timestamp.lte = filter.to;
  }
  return where;
}

function brandingWhere(
  filter: AuditLogFilter
): Prisma.AdvisorBrandingAuditLogWhereInput {
  const where: Prisma.AdvisorBrandingAuditLogWhereInput = {};
  // AdvisorBrandingAuditLog stores the actor in `userId`, not `actorUserId`.
  if (filter.actorUserId) where.userId = filter.actorUserId;
  if (filter.actions && filter.actions.length > 0) {
    const brandActions = filter.actions
      .map(denamespaceBrandingAction)
      .filter((a): a is string => typeof a === "string");
    if (brandActions.length > 0) where.action = { in: brandActions };
  }
  if (filter.entityId && filter.entityType === "AdvisorBranding") {
    // Branding rows have both `advisorId` (the FK) and `entityId` (free).
    // The unified entityId surfaces `entityId ?? advisorId`; mirror that
    // for filter routing so URLs constructed from the page's row links
    // round-trip cleanly.
    where.OR = [{ advisorId: filter.entityId }, { entityId: filter.entityId }];
  }
  if (filter.from || filter.to) {
    where.timestamp = {};
    if (filter.from) where.timestamp.gte = filter.from;
    if (filter.to) where.timestamp.lte = filter.to;
  }
  return where;
}

// ── Public API: list / count / stream ───────────────────────────────────

/**
 * Merge-and-sort: list audit rows across the three sources for one page.
 *
 * Pragmatic approach (offset pagination, in-memory merge):
 *   1. Determine which sources the filter touches via `routeFilter`.
 *   2. From each touched source, query `offset + take + 1` rows ordered
 *      DESC by createdAt. The +1 is the "is there a next page?" probe.
 *   3. Merge the three result lists into a single chronologically-ordered
 *      list. Slice [offset .. offset+take]. The (offset+take)-th row, if
 *      present, signals nextOffset.
 *
 * This over-fetches per-source (up to 3×(offset+take+1) total rows pulled)
 * but keeps merge logic trivially correct under all source-mix conditions.
 * At the audit-log's traffic profile (admin-only, ≤ 200/page) this is fine;
 * the alternative — a true cross-source keyset cursor — adds complexity
 * that isn't justified.
 */
export async function listAuditLog(
  filter: AuditLogFilter,
  pagination: AuditLogPagination = {}
): Promise<{ rows: UnifiedAuditRow[]; nextOffset: number | null }> {
  const take = Math.min(pagination.take ?? DEFAULT_TAKE, MAX_TAKE);
  const offset = Math.max(0, pagination.offset ?? 0);
  const probeCount = offset + take + 1;
  const route = routeFilter(filter);

  const [generic, subscription, branding] = await Promise.all([
    route.generic
      ? prisma.auditLog.findMany({
          where: genericWhere(filter),
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          take: probeCount,
        })
      : Promise.resolve([]),
    route.subscription
      ? prisma.subscriptionAuditLog.findMany({
          where: subscriptionWhere(filter),
          orderBy: [{ timestamp: "desc" }, { id: "desc" }],
          take: probeCount,
        })
      : Promise.resolve([]),
    route.branding
      ? prisma.advisorBrandingAuditLog.findMany({
          where: brandingWhere(filter),
          orderBy: [{ timestamp: "desc" }, { id: "desc" }],
          take: probeCount,
        })
      : Promise.resolve([]),
  ]);

  const merged: UnifiedAuditRow[] = [
    ...generic.map(genericAuditRowToUnified),
    ...subscription.map(subscriptionAuditRowToGeneric),
    ...branding.map(brandingAuditRowToGeneric),
  ];

  // DESC by createdAt; tiebreak on prefixed id so the order is deterministic
  // and stable across requests (important for a paginated UI).
  merged.sort((a, b) => {
    const t = b.createdAt.getTime() - a.createdAt.getTime();
    if (t !== 0) return t;
    return b.id < a.id ? -1 : b.id > a.id ? 1 : 0;
  });

  const slice = merged.slice(offset, offset + take);
  const hasMore = merged.length > offset + take;

  return {
    rows: slice,
    nextOffset: hasMore ? offset + take : null,
  };
}

/**
 * Total matching rows across the three sources. Sum of per-source counts;
 * each source uses its own indexed where clause.
 */
export async function countAuditLog(filter: AuditLogFilter): Promise<number> {
  const route = routeFilter(filter);
  const [g, s, b] = await Promise.all([
    route.generic
      ? prisma.auditLog.count({ where: genericWhere(filter) })
      : Promise.resolve(0),
    route.subscription
      ? prisma.subscriptionAuditLog.count({ where: subscriptionWhere(filter) })
      : Promise.resolve(0),
    route.branding
      ? prisma.advisorBrandingAuditLog.count({ where: brandingWhere(filter) })
      : Promise.resolve(0),
  ]);
  return g + s + b;
}

/**
 * Stream all matching rows in chronological-DESC order. Used by the CSV
 * export so we don't materialize everything in memory.
 *
 * Implementation: heap-merge across three async cursors. Each source pulls
 * `chunkSize` rows at a time via offset pagination (NOT keyset — same
 * reasoning as listAuditLog: simpler correctness across sources, fine at
 * the volume the audit log operates at). The merge reads one row at a
 * time from whichever source has the chronologically latest unconsumed row.
 *
 * Memory bound: 3 × chunkSize rows in memory at any time, regardless of
 * total row count.
 */
export async function* streamAuditLog(
  filter: AuditLogFilter,
  chunkSize = 500
): AsyncGenerator<UnifiedAuditRow, void, unknown> {
  const route = routeFilter(filter);

  // Per-source state: one buffer + offset per source, refilled on demand.
  type SourceState = {
    buffer: UnifiedAuditRow[];
    offset: number;
    exhausted: boolean;
  };

  const states: Record<"generic" | "subscription" | "branding", SourceState> = {
    generic: { buffer: [], offset: 0, exhausted: !route.generic },
    subscription: { buffer: [], offset: 0, exhausted: !route.subscription },
    branding: { buffer: [], offset: 0, exhausted: !route.branding },
  };

  const refill = async (source: "generic" | "subscription" | "branding"): Promise<void> => {
    const state = states[source];
    if (state.exhausted || state.buffer.length > 0) return;

    let raw: unknown[] = [];
    if (source === "generic") {
      raw = await prisma.auditLog.findMany({
        where: genericWhere(filter),
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: state.offset,
        take: chunkSize,
      });
      state.buffer = (raw as Parameters<typeof genericAuditRowToUnified>[0][]).map(
        genericAuditRowToUnified
      );
    } else if (source === "subscription") {
      raw = await prisma.subscriptionAuditLog.findMany({
        where: subscriptionWhere(filter),
        orderBy: [{ timestamp: "desc" }, { id: "desc" }],
        skip: state.offset,
        take: chunkSize,
      });
      state.buffer = (raw as Parameters<typeof subscriptionAuditRowToGeneric>[0][]).map(
        subscriptionAuditRowToGeneric
      );
    } else {
      raw = await prisma.advisorBrandingAuditLog.findMany({
        where: brandingWhere(filter),
        orderBy: [{ timestamp: "desc" }, { id: "desc" }],
        skip: state.offset,
        take: chunkSize,
      });
      state.buffer = (raw as Parameters<typeof brandingAuditRowToGeneric>[0][]).map(
        brandingAuditRowToGeneric
      );
    }

    state.offset += state.buffer.length;
    if (state.buffer.length < chunkSize) state.exhausted = true;
  };

  // Prime all sources.
  await Promise.all(
    (["generic", "subscription", "branding"] as const).map(refill)
  );

  while (true) {
    // Pick the source whose buffer head has the latest createdAt (DESC
    // merge). Break ties on id DESC, matching listAuditLog's sort.
    let bestSource: "generic" | "subscription" | "branding" | null = null;
    let bestRow: UnifiedAuditRow | null = null;
    for (const source of ["generic", "subscription", "branding"] as const) {
      const head = states[source].buffer[0];
      if (!head) continue;
      if (
        !bestRow ||
        head.createdAt.getTime() > bestRow.createdAt.getTime() ||
        (head.createdAt.getTime() === bestRow.createdAt.getTime() && head.id > bestRow.id)
      ) {
        bestSource = source;
        bestRow = head;
      }
    }

    if (!bestSource || !bestRow) return; // all sources drained

    states[bestSource].buffer.shift();
    yield bestRow;

    // Refill the source we just drew from if we emptied its buffer.
    if (states[bestSource].buffer.length === 0) {
      await refill(bestSource);
    }
  }
}

/**
 * Look up display info for the actorUserIds present in a page of audit rows.
 * Done in one batch query (not N+1) and returned as a Map. Falls back to the
 * actorEmailHash on the row when the User row is missing (hard-deleted).
 *
 * Unchanged from round-7: works the same on unified rows because the actor
 * field is the same shape after adapter projection.
 */
export async function lookupActorDisplay(
  actorUserIds: ReadonlyArray<string | null>
): Promise<Map<string, { email: string; name: string | null }>> {
  const ids = Array.from(
    new Set(actorUserIds.filter((id): id is string => typeof id === "string" && id.length > 0))
  );
  if (ids.length === 0) return new Map();
  const users = await prisma.user.findMany({
    where: { id: { in: ids } },
    select: { id: true, email: true, name: true },
  });
  return new Map(users.map((u) => [u.id, { email: u.email, name: u.name }]));
}

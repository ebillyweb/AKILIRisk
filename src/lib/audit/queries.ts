import "server-only";

import type { Prisma, AuditLog } from "@prisma/client";
import { prisma } from "@/lib/db";

/**
 * Filter shape for the admin audit-log page and CSV export. Both call the
 * same query helper so the table view and the export are guaranteed to
 * cover the same rows.
 *
 * `from` / `to` default to "last 7 days" at the call site, not here, so this
 * helper is reusable from contexts that want a different default.
 */
export interface AuditLogFilter {
  /** Exact actor user id. Null/undefined matches any actor. */
  actorUserId?: string | null;
  /** Exact action strings (any of). Empty array == match any. */
  actions?: string[];
  /** Exact entity type. */
  entityType?: string | null;
  /** Exact entity id (only meaningful with entityType). */
  entityId?: string | null;
  /** Inclusive lower bound on createdAt. */
  from?: Date | null;
  /** Inclusive upper bound on createdAt. */
  to?: Date | null;
}

export interface AuditLogPagination {
  /** Cursor on AuditLog.id for keyset pagination — pass the last id of the previous page. */
  cursor?: string | null;
  /** Default 50, capped to 200 to bound payload size. */
  take?: number;
}

const DEFAULT_TAKE = 50;
const MAX_TAKE = 200;

function buildWhere(filter: AuditLogFilter): Prisma.AuditLogWhereInput {
  const where: Prisma.AuditLogWhereInput = {};
  if (filter.actorUserId) where.actorUserId = filter.actorUserId;
  if (filter.actions && filter.actions.length > 0) {
    where.action = { in: filter.actions };
  }
  if (filter.entityType) where.entityType = filter.entityType;
  if (filter.entityId) where.entityId = filter.entityId;
  if (filter.from || filter.to) {
    where.createdAt = {};
    if (filter.from) where.createdAt.gte = filter.from;
    if (filter.to) where.createdAt.lte = filter.to;
  }
  return where;
}

export async function listAuditLog(
  filter: AuditLogFilter,
  pagination: AuditLogPagination = {}
): Promise<{ rows: AuditLog[]; nextCursor: string | null }> {
  const take = Math.min(pagination.take ?? DEFAULT_TAKE, MAX_TAKE);
  const where = buildWhere(filter);

  // Take +1 so we can detect "is there a next page" without a separate count.
  const rows = await prisma.auditLog.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: take + 1,
    ...(pagination.cursor
      ? { cursor: { id: pagination.cursor }, skip: 1 }
      : {}),
  });

  let nextCursor: string | null = null;
  if (rows.length > take) {
    const tail = rows.pop();
    if (tail) nextCursor = tail.id;
  }
  return { rows, nextCursor };
}

export async function countAuditLog(filter: AuditLogFilter): Promise<number> {
  return prisma.auditLog.count({ where: buildWhere(filter) });
}

/**
 * Stream all rows matching the filter, in createdAt-desc order, in chunks.
 * Used by the CSV export so we don't materialize 100k rows in memory.
 *
 * Implemented as keyset pagination over (createdAt, id) — same ordering as
 * the page view. Caller decides chunk size; default 500.
 */
export async function* streamAuditLog(
  filter: AuditLogFilter,
  chunkSize = 500
): AsyncGenerator<AuditLog, void, unknown> {
  const where = buildWhere(filter);
  let cursor: string | null = null;

  while (true) {
    const rows: AuditLog[] = await prisma.auditLog.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: chunkSize,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    if (rows.length === 0) return;
    for (const row of rows) yield row;
    if (rows.length < chunkSize) return;
    cursor = rows[rows.length - 1]!.id;
  }
}

/**
 * Look up display info for the actorUserIds present in a page of audit rows.
 * Done in one batch query (not N+1) and returned as a Map. Falls back to the
 * actorEmailHash on the row when the User row is missing (hard-deleted).
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

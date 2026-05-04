import "server-only";

import { prisma } from "@/lib/db";
import { writeAudit, AUDIT_ACTIONS } from "./audit-log";

/** Default when AUDIT_LOG_RETENTION_DAYS is unset or malformed. */
export const DEFAULT_AUDIT_RETENTION_DAYS = 365;

/**
 * Resolve the configured retention window. Exported so the cron route and
 * the unit tests share one source of truth.
 *
 * Defensive: returns the default for any non-positive or non-finite value.
 * A malformed env var should not turn into an unbounded delete or a 0-day
 * sweep that wipes the whole table.
 */
export function resolveRetentionDays(
  raw: string | null | undefined = process.env.AUDIT_LOG_RETENTION_DAYS
): number {
  const trimmed = raw?.trim();
  if (!trimmed) return DEFAULT_AUDIT_RETENTION_DAYS;
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n < 1) return DEFAULT_AUDIT_RETENTION_DAYS;
  return Math.floor(n);
}

export interface RetentionSweepResult {
  retentionDays: number;
  cutoffIso: string;
  deletedRows: number;
  durationMs: number;
}

/**
 * Run one retention sweep and self-audit it. Returns the sweep summary.
 *
 * Self-audit is written AFTER the deleteMany so the row's createdAt is
 * always after the cutoff (next sweep can't accidentally delete the audit
 * for the previous sweep).
 *
 * Throws on DB failure; caller decides whether to swallow (route returns 500)
 * or surface (test asserts).
 */
export async function runAuditLogRetentionSweep(
  retentionDays: number = resolveRetentionDays()
): Promise<RetentionSweepResult> {
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
  const startTime = Date.now();

  const result = await prisma.auditLog.deleteMany({
    where: { createdAt: { lt: cutoff } },
  });

  const durationMs = Date.now() - startTime;

  await writeAudit({
    actor: { userId: null },
    action: AUDIT_ACTIONS.SYSTEM_RETENTION_SWEEP,
    entityType: "AuditLog",
    entityId: null,
    metadata: {
      retentionDays,
      cutoffIso: cutoff.toISOString(),
      deletedRows: result.count,
      durationMs,
    },
  });

  return {
    retentionDays,
    cutoffIso: cutoff.toISOString(),
    deletedRows: result.count,
    durationMs,
  };
}

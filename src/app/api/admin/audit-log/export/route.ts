import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import type { UserRole } from "@prisma/client";
import { AUDIT_ACTIONS, writeAudit } from "@/lib/audit/audit-log";
import { getAuditAdminActorOrNull } from "@/lib/audit/admin-gate";
import {
  countAuditLog,
  streamAuditLog,
  type AuditLogFilter,
} from "@/lib/audit/queries";
import type { UnifiedAuditRow } from "@/lib/audit/adapters";

export const dynamic = "force-dynamic";

const DEFAULT_LOOKBACK_DAYS = 7;

function parseDateOrNull(raw: string | null): Date | null {
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

function toFilter(req: NextRequest): AuditLogFilter {
  const sp = req.nextUrl.searchParams;
  const actions = sp.getAll("action").filter((s) => s.length > 0);
  const from =
    parseDateOrNull(sp.get("from")) ??
    new Date(Date.now() - DEFAULT_LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
  const to = parseDateOrNull(sp.get("to"));
  return {
    actorUserId: sp.get("actorUserId")?.trim() || null,
    actions,
    entityType: sp.get("entityType")?.trim() || null,
    entityId: sp.get("entityId")?.trim() || null,
    from,
    to,
  };
}

/**
 * RFC-4180-ish CSV escape: wrap any field containing a quote, comma, or
 * newline in double quotes, doubling embedded quotes. Sufficient for our
 * payload columns which serialize JSON via JSON.stringify (no raw newlines
 * unless beforeData/afterData contained them, which JSON.stringify would
 * escape as \n inside a JSON string anyway).
 */
function csvEscape(value: string): string {
  if (value === "") return "";
  // Neutralize spreadsheet formula injection: a cell beginning with = + - @
  // (or tab/CR) can execute when opened in Excel/Sheets. Prefix with a quote.
  const guarded = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  if (/[",\n\r]/.test(guarded)) {
    return `"${guarded.replace(/"/g, '""')}"`;
  }
  return guarded;
}

const CSV_HEADER = [
  "id",
  "createdAt",
  "actorUserId",
  "actorRole",
  "actorEmailHash",
  "action",
  "entityType",
  "entityId",
  "beforeData",
  "afterData",
  "metadata",
  "ipAddress",
  "userAgent",
];

function rowToCsv(row: UnifiedAuditRow): string {
  return [
    row.id,
    row.createdAt.toISOString(),
    row.actorUserId ?? "",
    row.actorRole ?? "",
    row.actorEmailHash ?? "",
    row.action,
    row.entityType,
    row.entityId ?? "",
    row.beforeData === null || row.beforeData === undefined
      ? ""
      : JSON.stringify(row.beforeData),
    row.afterData === null || row.afterData === undefined
      ? ""
      : JSON.stringify(row.afterData),
    row.metadata === null || row.metadata === undefined
      ? ""
      : JSON.stringify(row.metadata),
    row.ipAddress ?? "",
    row.userAgent ?? "",
  ]
    .map(csvEscape)
    .join(",");
}

function filenameFromFilter(filter: AuditLogFilter): string {
  const fmt = (d: Date | null | undefined) =>
    d ? d.toISOString().slice(0, 10) : "open";
  return `audit-log-${fmt(filter.from)}-${fmt(filter.to)}.csv`;
}

export async function GET(request: NextRequest) {
  const actor = await getAuditAdminActorOrNull();
  if (!actor) {
    // 404 not 401/403 — same existence-leak posture as the page route.
    return new NextResponse(null, { status: 404 });
  }

  const filter = toFilter(request);

  // BEFORE streaming: total row count + the filter hash for the audit row.
  const totalCount = await countAuditLog(filter);
  const filterHash = createHash("sha256")
    .update(request.nextUrl.search || "")
    .digest("hex")
    .slice(0, 16);

  // Audit the export action itself. await — the user is initiating, the
  // small added latency is acceptable, and we want the audit row written
  // before the bytes start flowing so a partial download still leaves a
  // record. Per P5: NOT deduped (each export is meaningful).
  await writeAudit({
    actor: { userId: actor.userId, role: actor.role as UserRole, email: actor.email },
    action: AUDIT_ACTIONS.DATA_ACCESS_EXPORT,
    entityType: "AuditLog",
    entityId: null,
    metadata: {
      format: "csv",
      filterHash,
      rowCount: totalCount,
    },
    request,
  });

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder();
      try {
        controller.enqueue(encoder.encode(CSV_HEADER.join(",") + "\n"));
        for await (const row of streamAuditLog(filter)) {
          controller.enqueue(encoder.encode(rowToCsv(row) + "\n"));
        }
        controller.close();
      } catch (e) {
        // Surface as a stream error so the browser shows a partial download
        // rather than silently truncating. The audit row was already written
        // BEFORE streaming started, so the export attempt is recorded
        // regardless of whether it completed.
        console.error("[audit-log/export] stream error:", e);
        controller.error(e);
      }
    },
  });

  return new NextResponse(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filenameFromFilter(filter)}"`,
      "Cache-Control": "private, no-store",
    },
  });
}

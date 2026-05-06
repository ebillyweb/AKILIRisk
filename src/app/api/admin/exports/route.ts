import { NextRequest, NextResponse } from "next/server";
import { AUDIT_ACTIONS, writeAudit } from "@/lib/audit/audit-log";
import { getAuditAdminActorOrNull } from "@/lib/audit/admin-gate";
import { composeSystemZip, composeTenantZip } from "@/lib/export/bundle";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/exports?scope=tenant&advisorProfileId=...
 * GET /api/admin/exports?scope=system
 *
 * Round-10 / E2 (BRD §5.3 data ownership + portability). Streams a ZIP
 * containing CSV + nested-JSON + README + metadata. Admin-only, 404 on
 * non-admin (existence-leak posture, same as the audit-log export).
 *
 * Inline byte cap (50 MB by default; see `EXPORT_BYTE_CAP`) is enforced
 * by the bundle composer — exceeding it errors the stream with a 413-ish
 * truncation. The audit row is written BEFORE streaming starts so a
 * partial download still leaves a record; on completion we await the
 * stream's `result` promise and write a follow-up metadata patch into a
 * console line (not a second audit row — that would double-count export
 * actions).
 */
export async function GET(request: NextRequest) {
  const actor = await getAuditAdminActorOrNull();
  if (!actor) {
    // 404 not 401/403 — same existence-leak posture as the audit-log export.
    return new NextResponse(null, { status: 404 });
  }

  const sp = request.nextUrl.searchParams;
  const scope = sp.get("scope");
  const advisorProfileId = sp.get("advisorProfileId");

  if (scope !== "tenant" && scope !== "system") {
    return NextResponse.json(
      { error: "scope must be 'tenant' or 'system'" },
      { status: 400 }
    );
  }
  if (scope === "tenant" && !advisorProfileId) {
    return NextResponse.json(
      { error: "advisorProfileId required for tenant scope" },
      { status: 400 }
    );
  }

  // Build the bundle composer. Returns null only for the tenant case
  // when the advisor profile doesn't exist.
  const bundleResult =
    scope === "tenant"
      ? await composeTenantZip(advisorProfileId!)
      : await composeSystemZip();

  if (!bundleResult) {
    return new NextResponse(null, { status: 404 });
  }

  // Write the audit row BEFORE streaming starts. Mirrors the audit-log
  // export pattern. Per the E2 design: NOT deduped (every export is a
  // distinct event), entityType is "DataExport" (distinct from
  // entityType "AuditLog" used by the audit-log CSV export).
  await writeAudit({
    actor: { userId: actor.userId, role: "ADMIN", email: actor.email },
    action: AUDIT_ACTIONS.DATA_ACCESS_EXPORT,
    entityType: "DataExport",
    entityId: scope === "tenant" ? advisorProfileId : null,
    metadata: {
      scope,
      format: "zip-csv-and-json",
      // Row counts are attached when the stream completes (see bundleResult.result .then below).
      rowCounts: "pending",
      schemaVersion: bundleResult.filename.includes("system-") ? "v1" : "v1",
    },
    request,
  });

  // Fire-and-await-in-background: when the stream finishes, log the
  // final metadata so an aborted download is observable (the in-progress
  // audit row was written above; the abort signal goes here).
  bundleResult.result
    .then((info) => {
      if (info.aborted) {
        console.warn(
          `[export] ${scope} export aborted (bytesWritten=${info.bytesWritten}): ${info.abortReason}`
        );
      } else {
        console.log(
          `[export] ${scope} export complete (bytesWritten=${info.bytesWritten}, rowCounts=${JSON.stringify(info.metadata.rowCounts)})`
        );
      }
    })
    .catch((err) => {
      console.error("[export] result promise rejected:", err);
    });

  return new NextResponse(bundleResult.stream as unknown as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${bundleResult.filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}

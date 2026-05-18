import { NextResponse } from "next/server";
import { getAuditAdminActorOrNull } from "@/lib/audit/admin-gate";
import { getCachedControlCenterSnapshot } from "@/lib/admin/control-center-snapshot-cached";
import { validateControlCenterSnapshot } from "@/lib/admin/control-center-validation";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/control-center
 *
 * JSON snapshot for control-center polling. Returns 404 when the caller
 * is not a platform admin (same posture as other admin API routes).
 */
export async function GET() {
  const actor = await getAuditAdminActorOrNull();
  if (!actor) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const snapshot = await getCachedControlCenterSnapshot();

  // Validate the snapshot before returning
  const validation = validateControlCenterSnapshot(snapshot);
  if (!validation.success) {
    console.error('Control center snapshot validation failed:', validation.error);
    return NextResponse.json(
      { error: "Data validation failed" },
      { status: 500 }
    );
  }

  return NextResponse.json(validation.data, {
    headers: {
      "Cache-Control": "private, max-age=10, stale-while-revalidate=30",
    },
  });
}

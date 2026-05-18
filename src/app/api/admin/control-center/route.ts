import { NextResponse } from "next/server";
import { getAuditAdminActorOrNull } from "@/lib/audit/admin-gate";
import { getControlCenterSnapshot } from "@/lib/admin/control-center-snapshot";

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

  const snapshot = await getControlCenterSnapshot();

  return NextResponse.json(snapshot, {
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
}

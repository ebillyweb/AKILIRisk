import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getPlatformPillarCatalog } from "@/lib/methodology/cached-pillar-catalog";

/** Read-only platform pillar catalog for client UI (labels, ordering, validation). */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const catalog = await getPlatformPillarCatalog();
  return NextResponse.json(catalog);
}

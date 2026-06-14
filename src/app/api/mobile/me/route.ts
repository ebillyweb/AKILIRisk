import { NextRequest, NextResponse } from "next/server";
import { resolveUser } from "@/lib/mobile/token";

/** GET /api/mobile/me — current user for the bearer token (session refresh). */
export async function GET(request: NextRequest) {
  const user = await resolveUser(request);
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  return NextResponse.json({ user });
}

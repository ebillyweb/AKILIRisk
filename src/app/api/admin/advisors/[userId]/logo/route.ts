import { NextResponse } from "next/server";

import { getAuditAdminActorOrNull } from "@/lib/audit/admin-gate";
import { prisma } from "@/lib/db";
import { getBrandingLogoObjectBytes } from "@/lib/s3/branding-uploads";

/**
 * Admin-only: stream an advisor's branding logo from S3 for the advisors list (white label preview).
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ userId: string }> }
) {
  // Auth check runs OUTSIDE the try/catch so a missing/non-admin actor
  // returns 404 (existence-leak posture) instead of being caught by the
  // generic 500 handler below.
  const actor = await getAuditAdminActorOrNull();
  if (!actor) {
    return new NextResponse(null, { status: 404 });
  }

  try {
    const { userId } = await context.params;

    const advisor = await prisma.advisorProfile.findUnique({
      where: { userId },
      select: {
        id: true,
        logoS3Key: true,
        logoContentType: true,
        user: { select: { role: true } },
      },
    });

    if (!advisor || advisor.user.role !== "ADVISOR" || !advisor.logoS3Key) {
      return new NextResponse(null, { status: 404 });
    }

    const prefix = `advisors/${advisor.id}/`;
    if (!advisor.logoS3Key.startsWith(prefix)) {
      return new NextResponse(null, { status: 404 });
    }

    const { data, contentType } = await getBrandingLogoObjectBytes(advisor.logoS3Key);

    return new NextResponse(Buffer.from(data), {
      headers: {
        "Content-Type": advisor.logoContentType || contentType,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (e) {
    console.error("Admin advisor logo error:", e);
    return new NextResponse(null, { status: 500 });
  }
}

import { NextResponse } from "next/server";

import { resolveAdminAdvisorLogoForUser } from "@/lib/admin/advisor-logo";
import { getAuditAdminActorOrNull } from "@/lib/audit/admin-gate";
import { getBrandingLogoObjectBytes } from "@/lib/s3/branding-uploads";

/**
 * Admin-only: stream an advisor's branding logo from S3 for the advisors list (white label preview).
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ userId: string }> }
) {
  const actor = await getAuditAdminActorOrNull();
  if (!actor) {
    return new NextResponse(null, { status: 404 });
  }

  try {
    const { userId } = await context.params;
    const logo = await resolveAdminAdvisorLogoForUser(userId);
    if (!logo) {
      return new NextResponse(null, { status: 404 });
    }

    const { data, contentType } = await getBrandingLogoObjectBytes(logo.logoS3Key);

    return new NextResponse(Buffer.from(data), {
      headers: {
        "Content-Type": logo.logoContentType || contentType,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (e) {
    console.error("Admin advisor logo error:", e);
    return new NextResponse(null, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isPlatformAdminRole } from "@/lib/auth-roles";
import { buildExecutiveReportSnapshot } from "@/lib/pdf/build-executive-report-snapshot";
import { getAdvisorBrandingForPDF } from "@/lib/pdf/branding-integration";
import { renderExecutiveReportPdf } from "@/lib/pdf/render-executive-report";
import type { ExecutiveReportSnapshot } from "@/lib/pdf/executive-report-types";
import type { AdvisorBrandingData } from "@/lib/validation/branding";

/**
 * Phase 25 (D-01, D-17, D-18, D-21): Executive Report PDF route.
 *
 * Three-bucket auth (mirrors src/app/api/reports/by-id/[reportId]/pdf/route.tsx):
 *   isOwner (client) || isAdmin || isAssignedAdvisor
 *
 * Security gates (STRIDE threat register):
 *   T-25-04: advisorNotes never in client variant (variant prop controls pages at render time)
 *   T-25-05: variant=advisor + isOwner -> 403 (clients cannot access Advisor Brief)
 *   T-25-06: no session -> 401
 *   T-25-07: advisor must be assigned to this client (not just any advisor)
 *   T-25-08: isOwner + DRAFT -> 403 (clients cannot see drafts per D-21)
 *
 * Query param: ?variant=advisor (default: "client")
 * PUBLISHED / SUPERSEDED: render from frozen executiveSnapshotData + brandingSnapshot.
 * DRAFT: build live snapshot + fetch live branding.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ reportId: string }> }
) {
  try {
    // T-25-06: auth gate
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    const { reportId } = await params;

    // Fetch the ExecutiveReport row
    const report = await prisma.executiveReport.findUnique({
      where: { id: reportId },
      select: {
        id: true,
        clientId: true,
        advisorProfileId: true,
        status: true,
        version: true,
        executiveSnapshotData: true,
        brandingSnapshot: true,
        advisorNotes: true,
        meetingAgenda: true,
        discussionPrompts: true,
        reportingPeriodStart: true,
        reportingPeriodEnd: true,
        client: { select: { id: true } },
        advisorProfile: { select: { id: true, userId: true } },
      },
    });

    if (!report) {
      return NextResponse.json(
        { error: "Executive report not found" },
        { status: 404 }
      );
    }

    // Three-bucket auth determination
    const sessionUserId = session.user.id;
    const sessionRole = session.user.role;
    const isOwner = report.client.id === sessionUserId;
    const isAdmin = isPlatformAdminRole(sessionRole ?? undefined);

    let isAssignedAdvisor = false;
    if (!isOwner && !isAdmin && sessionRole === "ADVISOR") {
      // T-25-07: advisor must be the one assigned to this specific client
      const isThisAdvisor =
        report.advisorProfile.userId === sessionUserId;
      if (isThisAdvisor) {
        // Verify active assignment
        const assignment = await prisma.clientAdvisorAssignment.findFirst({
          where: {
            advisorId: report.advisorProfileId,
            clientId: report.clientId,
            status: "ACTIVE",
          },
          select: { id: true },
        });
        isAssignedAdvisor = assignment != null;
      }
    }

    if (!isOwner && !isAdmin && !isAssignedAdvisor) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // T-25-08: clients cannot see draft executive reports (D-21)
    if (report.status === "DRAFT" && isOwner && !isAdmin && !isAssignedAdvisor) {
      return NextResponse.json(
        { error: "Draft executive reports are not available to clients" },
        { status: 403 }
      );
    }

    // Variant determination: ?variant=advisor defaults to "client"
    const url = new URL(_request.url);
    const variantParam = url.searchParams.get("variant");
    const variant: "client" | "advisor" =
      variantParam === "advisor" ? "advisor" : "client";

    // T-25-05: clients (isOwner) cannot access Advisor Brief variant (D-17)
    if (variant === "advisor" && isOwner && !isAdmin && !isAssignedAdvisor) {
      return NextResponse.json(
        { error: "Advisor Brief is not available to clients" },
        { status: 403 }
      );
    }

    const isDraft = report.status === "DRAFT";

    // Resolve snapshot and branding
    let snapshot: ExecutiveReportSnapshot;
    let branding: AdvisorBrandingData | null;

    if (isDraft) {
      // DRAFT: build live snapshot + fetch live branding
      snapshot = await buildExecutiveReportSnapshot(
        report.clientId,
        report.advisorProfileId
      );
      branding = await getAdvisorBrandingForPDF(report.advisorProfileId);

      // Overlay editorial fields from the DRAFT row onto live snapshot (D-18)
      snapshot = {
        ...snapshot,
        advisorNotes: report.advisorNotes ?? null,
        meetingAgenda: report.meetingAgenda ?? null,
        discussionPrompts: Array.isArray(report.discussionPrompts)
          ? (report.discussionPrompts as string[])
          : [],
      };
    } else {
      // PUBLISHED / SUPERSEDED: render from frozen executiveSnapshotData
      if (!report.executiveSnapshotData) {
        return NextResponse.json(
          { error: "Executive report snapshot is missing" },
          { status: 500 }
        );
      }
      snapshot = report.executiveSnapshotData as unknown as ExecutiveReportSnapshot;
      branding = (report.brandingSnapshot ?? null) as AdvisorBrandingData | null;
    }

    // Render PDF
    const { bytes, filenameSlugFirm } = await renderExecutiveReportPdf({
      snapshot,
      branding,
      variant,
      draft: isDraft,
    });

    // Build Content-Disposition filename
    const versionSlug = `v${report.version}${isDraft ? "-draft" : ""}`;
    const fileType =
      variant === "advisor" ? "advisor-brief" : "executive-report";
    const filename = `${filenameSlugFirm}-${fileType}-${versionSlug}.pdf`;

    return new NextResponse(bytes as unknown as BodyInit, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-cache, no-store, must-revalidate",
        Pragma: "no-cache",
        Expires: "0",
      },
    });
  } catch (error) {
    console.error("Error rendering Executive Report PDF:", error);
    return NextResponse.json(
      { error: "Failed to render executive report" },
      { status: 500 }
    );
  }
}

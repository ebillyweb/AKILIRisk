import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isPlatformAdminRole } from "@/lib/auth-roles";
import { renderToBuffer } from "@react-pdf/renderer";
import { AssessmentReport } from "@/lib/pdf/components/AssessmentReport";
import { createBrandedPDFMetadata } from "@/lib/pdf/branding-integration";
import {
  buildReportSnapshot,
  buildBrandingSnapshot,
  type ReportSnapshot,
} from "@/lib/pdf/build-report-snapshot";
import type { AdvisorBrandingData } from "@/lib/validation/branding";

/**
 * §4.5 commit 3 (BRD §4.5): strict-snapshot PDF route. Resolves a Report
 * row by id and renders from `snapshotData` + `brandingSnapshot` for
 * PUBLISHED / SUPERSEDED rows; from live data with a "DRAFT — NOT
 * PUBLISHED" watermark for DRAFT rows.
 *
 * Auth gate: same as commit 2 — assessment owner OR active-assigned
 * advisor OR admin. DRAFT rows additionally restricted to advisor +
 * admin (clients never see drafts; the legacy /api/reports/[id]/pdf
 * route is the client-facing path and renders draft-with-watermark on
 * its own when no PUBLISHED row exists).
 *
 * Audit: NOT written here. The shim layer at /api/reports/[id]/pdf
 * writes a single REPORT_DOWNLOAD row that records the resolved Report
 * id in metadata; double-counting from this route would inflate the
 * download count.
 */

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ reportId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    const { reportId } = await params;

    const report = await prisma.report.findUnique({
      where: { id: reportId },
      select: {
        id: true,
        assessmentId: true,
        status: true,
        version: true,
        templateChoice: true,
        executiveSummary: true,
        advisorNotes: true,
        snapshotData: true,
        brandingSnapshot: true,
        publishedAt: true,
        assessment: { select: { userId: true } },
      },
    });
    if (!report) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }

    // Auth gate.
    const sessionUserId = session.user.id;
    const sessionRole = session.user.role;
    const ownerUserId = report.assessment.userId;
    const isOwner = ownerUserId === sessionUserId;
    const isAdmin = isPlatformAdminRole(sessionRole ?? undefined);
    let isAssignedAdvisor = false;
    if (!isOwner && !isAdmin && sessionRole === "ADVISOR") {
      const advisor = await prisma.advisorProfile.findUnique({
        where: { userId: sessionUserId },
        select: { id: true },
      });
      if (advisor) {
        const assignment = await prisma.clientAdvisorAssignment.findFirst({
          where: {
            advisorId: advisor.id,
            clientId: ownerUserId,
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

    // Clients (owner role USER) cannot view DRAFT rows.
    if (report.status === "DRAFT" && isOwner && !isAdmin && !isAssignedAdvisor) {
      return NextResponse.json(
        { error: "Draft reports are not available to clients" },
        { status: 403 }
      );
    }

    // Resolve render inputs. PUBLISHED / SUPERSEDED render strictly
    // from frozen JSON; DRAFT renders from live data with watermark.
    let snapshot: ReportSnapshot;
    let branding: AdvisorBrandingData | null;
    const isDraft = report.status === "DRAFT";

    if (isDraft) {
      snapshot = await buildReportSnapshot(report.assessmentId);
      branding = await buildBrandingSnapshot(report.assessmentId);
    } else {
      if (!report.snapshotData) {
        // Defensive: a PUBLISHED row with null snapshot indicates a
        // failed publish transaction or a half-applied backfill. 500.
        return NextResponse.json(
          { error: "Report snapshot is missing" },
          { status: 500 }
        );
      }
      snapshot = report.snapshotData as unknown as ReportSnapshot;
      branding = (report.brandingSnapshot ?? null) as AdvisorBrandingData | null;
    }

    // Build cover-branding shape (same selection the legacy route uses).
    const coverBranding = branding
      ? {
          firmName: branding.brandName || branding.advisorFirmName || undefined,
          logoUrl: branding.logoUrl ?? undefined,
        }
      : undefined;

    const pdfMetadata = createBrandedPDFMetadata(branding ?? undefined);

    const pdfBuffer = await renderToBuffer(
      <AssessmentReport
        data={snapshot.reportData}
        householdProfile={snapshot.householdProfile ?? undefined}
        advisorBranding={coverBranding}
        documentMetadata={pdfMetadata}
        draft={isDraft}
      />
    );

    const brandName =
      branding?.brandName ||
      branding?.advisorFirmName ||
      "akili-risk";
    const firmSlug = brandName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    const versionSlug = `v${report.version}${isDraft ? "-draft" : ""}`;

    return new NextResponse(pdfBuffer as unknown as BodyInit, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${firmSlug}-${versionSlug}-report.pdf"`,
        "Cache-Control": "no-cache, no-store, must-revalidate",
        Pragma: "no-cache",
        Expires: "0",
      },
    });
  } catch (error) {
    console.error("Error rendering Report PDF:", error);
    return NextResponse.json(
      { error: "Failed to render report" },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { AUDIT_ACTIONS, writeAudit } from "@/lib/audit/audit-log";
import { renderReportPdf, renderLivePreviewForAssessment } from "@/lib/pdf/render-report";
import type { ReportSnapshot } from "@/lib/pdf/build-report-snapshot";
import type { AdvisorBrandingData } from "@/lib/validation/branding";

/**
 * Legacy PDF route, now a shim. The path uses an Assessment id (the
 * `[id]` segment) for back-compat with the client's `DownloadSection`
 * blob fetch. As of §4.5 commit 3 it resolves the latest PUBLISHED
 * Report for that assessment and renders strictly from its snapshot.
 *
 * Resolution order:
 *
 *   1. PUBLISHED Report (most recent publishedAt) → render from
 *      snapshotData. Audit metadata records the resolved Report id.
 *   2. No PUBLISHED Report → live data with "DRAFT — NOT PUBLISHED"
 *      watermark. The legacy "preview before first publish" path. Sign-
 *      off §5 of the design proposal: clients in this state see the
 *      watermarked draft (no advisor has published yet).
 *
 * Auth gate: assessment owner OR active-assigned advisor OR admin.
 * Identical to commit 2.
 *
 * Audit: ONE row per render at this layer. The new
 * /api/reports/by-id/[reportId]/pdf route deliberately does not audit
 * (would double-count when this shim forwards to it via the helper).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    const { id } = await params;

    // Auth gate.
    const assessment = await prisma.assessment.findUnique({
      where: { id },
      select: { userId: true },
    });
    if (!assessment) {
      return NextResponse.json(
        { error: "Assessment not found" },
        { status: 404 }
      );
    }

    const sessionUserId = session.user.id;
    const sessionRole = session.user.role;
    const isOwner = assessment.userId === sessionUserId;
    const isAdmin = sessionRole === "ADMIN";

    let isAssignedAdvisor = false;
    if (!isOwner && !isAdmin && sessionRole === "ADVISOR") {
      const advisorProfile = await prisma.advisorProfile.findUnique({
        where: { userId: sessionUserId },
        select: { id: true },
      });
      if (advisorProfile) {
        const assignment = await prisma.clientAdvisorAssignment.findFirst({
          where: {
            advisorId: advisorProfile.id,
            clientId: assessment.userId,
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

    // Resolve the latest PUBLISHED Report for this assessment.
    const published = await prisma.report.findFirst({
      where: { assessmentId: id, status: "PUBLISHED" },
      orderBy: { publishedAt: "desc" },
      select: {
        id: true,
        version: true,
        snapshotData: true,
        brandingSnapshot: true,
      },
    });

    let renderResult;
    let resolvedReportId: string | null = null;
    let resolvedVersion: number | null = null;
    let renderedDraft = false;

    if (published && published.snapshotData) {
      resolvedReportId = published.id;
      resolvedVersion = published.version;
      renderResult = await renderReportPdf({
        snapshot: published.snapshotData as unknown as ReportSnapshot,
        branding: (published.brandingSnapshot ?? null) as AdvisorBrandingData | null,
        draft: false,
      });
    } else {
      // No PUBLISHED Report: render live with watermark. Per §9 of the
      // design (sign-off): clients see the watermarked PDF rather than
      // a "report not yet published" message. Throws if the assessment
      // hasn't been scored — surface as 404.
      try {
        renderResult = await renderLivePreviewForAssessment(id);
        renderedDraft = true;
      } catch (err) {
        if (err instanceof Error && /no PillarScore/i.test(err.message)) {
          return NextResponse.json(
            { error: "Complete assessment to generate report" },
            { status: 404 }
          );
        }
        throw err;
      }
    }

    void writeAudit({
      actor: {
        userId: sessionUserId,
        role: sessionRole ?? null,
        email: session.user.email ?? null,
      },
      action: AUDIT_ACTIONS.REPORT_DOWNLOAD,
      entityType: "Assessment",
      entityId: id,
      metadata: {
        actorRole: sessionRole ?? "USER",
        clientUserId: assessment.userId,
        pdfBytes: renderResult.bytes.byteLength,
        // §4.5 commit 3: which Report row resolved (null when the route
        // fell back to a live-data preview because no PUBLISHED row
        // existed yet).
        resolvedReportId,
        resolvedVersion,
        renderedDraft,
      },
      request,
    });

    const versionSlug =
      resolvedVersion != null
        ? `v${resolvedVersion}`
        : renderedDraft
          ? "preview-draft"
          : "report";

    return new NextResponse(renderResult.bytes as unknown as BodyInit, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${renderResult.filenameSlugFirm}-${versionSlug}-report.pdf"`,
        "Cache-Control": "no-cache, no-store, must-revalidate",
        Pragma: "no-cache",
        Expires: "0",
      },
    });
  } catch (error) {
    console.error("Error generating PDF report:", error);
    return NextResponse.json(
      { error: "Failed to generate report" },
      { status: 500 }
    );
  }
}

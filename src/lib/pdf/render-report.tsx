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
 * §4.5 commit 3 (BRD §4.5): shared PDF render helper used by both
 * `/api/reports/by-id/[reportId]/pdf` (the strict-snapshot route) and
 * `/api/reports/[id]/pdf` (the legacy assessment-id shim). Composes the
 * snapshot + branding into an `<AssessmentReport>` and serializes via
 * `renderToBuffer`. Pure function; no auth, no audit, no Prisma reads
 * beyond what `buildReportSnapshot` does internally.
 */

interface RenderInput {
  /** Frozen snapshot when PUBLISHED/SUPERSEDED; live snapshot when DRAFT. */
  snapshot: ReportSnapshot;
  /** Frozen branding when PUBLISHED/SUPERSEDED; live branding when DRAFT. */
  branding: AdvisorBrandingData | null;
  /** Adds the diagonal watermark when true. */
  draft: boolean;
}

export interface RenderResult {
  bytes: Uint8Array;
  /** Suggested filename slug — `<firmSlug>-<versionSlug>-report.pdf`. */
  filenameSlugFirm: string;
}

/** Pure render: snapshot + branding → PDF bytes. */
export async function renderReportPdf(input: RenderInput): Promise<RenderResult> {
  const { snapshot, branding, draft } = input;

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
      draft={draft}
    />
  );

  const brandName =
    branding?.brandName || branding?.advisorFirmName || "akili-risk";
  const firmSlug = brandName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  return { bytes: pdfBuffer as unknown as Uint8Array, filenameSlugFirm: firmSlug };
}

/**
 * Convenience: build a live (DRAFT-preview) snapshot + branding and
 * render. Used by the legacy assessment-id route when no PUBLISHED
 * Report exists yet.
 */
export async function renderLivePreviewForAssessment(
  assessmentId: string
): Promise<RenderResult> {
  const snapshot = await buildReportSnapshot(assessmentId);
  const branding = await buildBrandingSnapshot(assessmentId);
  return renderReportPdf({ snapshot, branding, draft: true });
}

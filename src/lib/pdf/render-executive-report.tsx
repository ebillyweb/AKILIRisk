import { renderToBuffer } from "@react-pdf/renderer";
import { ExecutiveReportDocument } from "@/lib/pdf/components/ExecutiveReport";
import { createBrandedPDFMetadata } from "@/lib/pdf/branding-integration";
import { buildExecutiveReportSnapshot } from "@/lib/pdf/build-executive-report-snapshot";
import type { ExecutiveReportSnapshot } from "@/lib/pdf/executive-report-types";
import type { AdvisorBrandingData } from "@/lib/validation/branding";

/**
 * Phase 25: Pure render function for Executive Report PDFs.
 *
 * Mirrors render-report.tsx exactly. No auth, no audit, no Prisma writes.
 * Converts snapshot + branding + variant into PDF bytes.
 */

interface RenderInput {
  /** Frozen snapshot (PUBLISHED) or live snapshot (DRAFT). */
  snapshot: ExecutiveReportSnapshot;
  /** Frozen branding (PUBLISHED) or live branding (DRAFT). */
  branding: AdvisorBrandingData | null;
  /** "client" = client-facing Executive Report; "advisor" = Advisor Brief (adds internal pages). */
  variant: "client" | "advisor";
  /** Adds diagonal DRAFT watermark when true. */
  draft: boolean;
}

export interface RenderResult {
  bytes: Uint8Array;
  /** Suggested filename slug: `<firmSlug>`. Used to build Content-Disposition. */
  filenameSlugFirm: string;
}

/**
 * Pure render: snapshot + branding + variant -> PDF bytes.
 *
 * Anti-patterns:
 * - No SVG / canvas / chart library imports (D-14)
 * - No percentage widths in deeply nested flex (Pitfall 6)
 * - advisorNotes/meetingAgenda/discussionPrompts excluded from client variant at
 *   the Document component level, not here (D-17, Pitfall 2)
 */
export async function renderExecutiveReportPdf(
  input: RenderInput
): Promise<RenderResult> {
  const { snapshot, branding, variant, draft } = input;

  const pdfMetadata = createBrandedPDFMetadata(branding ?? undefined);

  const pdfBuffer = await renderToBuffer(
    <ExecutiveReportDocument
      snapshot={snapshot}
      branding={branding}
      variant={variant}
      draft={draft}
      documentMetadata={pdfMetadata}
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
 * Convenience: build a live (DRAFT-preview) snapshot and render.
 *
 * Callers must verify advisor-client assignment before calling (T-25-01).
 * Branding is fetched externally and passed in (same pattern as render-report.tsx).
 */
export async function renderLiveExecutivePreview(
  clientId: string,
  advisorProfileId: string,
  variant: "client" | "advisor",
  branding: AdvisorBrandingData | null = null
): Promise<RenderResult> {
  const snapshot = await buildExecutiveReportSnapshot(
    clientId,
    advisorProfileId
  );
  return renderExecutiveReportPdf({ snapshot, branding, variant, draft: true });
}

/**
 * Fixed-input white-label PDF branding probe.
 *
 * Renders the real AssessmentReport cover path via `renderReportPdf` with a
 * synthetic snapshot + distinctive advisor branding. No assessment DB reads,
 * no writes. Used by the scheduled `@smoke` canary.
 */

import { pdfDisplayNameFromBranding } from "@/lib/pdf/branding-integration";
import { renderReportPdf } from "@/lib/pdf/render-report";
import type { ReportSnapshot } from "@/lib/pdf/build-report-snapshot";
import type { AdvisorBrandingData } from "@/lib/validation/branding";

/** Distinctive firm name — must appear in rendered PDF cover + metadata. */
export const SMOKE_PDF_FIRM_NAME = "Smoke WL PDF Partners LLC";

/** Tiny 1×1 PNG so react-pdf exercises the logo Image path without network. */
export const SMOKE_PDF_LOGO_DATA_URI =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

export const SMOKE_PDF_BRANDING: AdvisorBrandingData = {
  brandName: SMOKE_PDF_FIRM_NAME,
  advisorFirmName: SMOKE_PDF_FIRM_NAME,
  tagline: "Smoke white-label PDF canary",
  primaryColor: "#0A5C8A",
  secondaryColor: "#F2F7FA",
  accentColor: "#C45C26",
  logoUrl: SMOKE_PDF_LOGO_DATA_URI,
  brandingEnabled: true,
  customDomainEnabled: false,
  supportEmail: "smoke-wl-pdf@example.com",
  websiteUrl: "https://smoke-wl-pdf.example.com",
};

/** Minimal snapshot — enough for cover + one executive page. */
export const SMOKE_PDF_SNAPSHOT: ReportSnapshot = {
  schemaVersion: 1,
  pillar: "governance",
  reportData: {
    score: 6.5,
    riskLevel: "MEDIUM",
    breakdown: [
      {
        name: "Governance",
        score: 6.5,
        maxScore: 10,
        subcategoryCount: 3,
      },
    ],
    missingControls: [],
    assessmentDate: "2026-07-19",
    completionPercentage: 100,
    categoryCount: 1,
    missingControlsCount: 0,
    pillarScores: [
      { pillar: "governance", score: 6.5, riskLevel: "MEDIUM" },
    ],
    pillarNarratives: [],
  },
  householdProfile: null,
};

export type WhiteLabelPdfSmokeProbeResult = {
  bytes: Uint8Array;
  filenameSlugFirm: string;
  firmName: string;
  /** True when the firm name is embedded as readable text in the PDF. */
  firmNameEmbedded: boolean;
  /** True when default platform copy is NOT the only branding signal. */
  usesWhiteLabelFirm: boolean;
  byteLength: number;
};

function pdfContainsFirmName(bytes: Uint8Array, firmName: string): boolean {
  return Buffer.from(bytes).toString("latin1").includes(firmName);
}

/**
 * Render a white-label PDF and verify branding landed in the bytes.
 * Throws when render succeeds but branding is missing from the output.
 */
export async function runWhiteLabelPdfSmokeProbe(opts?: {
  branding?: AdvisorBrandingData | null;
  snapshot?: ReportSnapshot;
}): Promise<WhiteLabelPdfSmokeProbeResult> {
  const branding = opts?.branding === undefined ? SMOKE_PDF_BRANDING : opts.branding;
  const snapshot = opts?.snapshot ?? SMOKE_PDF_SNAPSHOT;

  const { bytes, filenameSlugFirm } = await renderReportPdf({
    snapshot,
    branding,
    draft: true,
  });

  const firmName = pdfDisplayNameFromBranding(branding);

  const firmNameEmbedded = pdfContainsFirmName(bytes, firmName);
  const usesWhiteLabelFirm =
    firmName !== "Akili Risk" && firmNameEmbedded;

  if (branding && !firmNameEmbedded) {
    throw new Error(
      `White-label PDF probe rendered without embedded firm name "${firmName}"`,
    );
  }

  return {
    bytes,
    filenameSlugFirm,
    firmName,
    firmNameEmbedded,
    usesWhiteLabelFirm,
    byteLength: bytes.byteLength,
  };
}

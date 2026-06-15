import { renderToBuffer } from "@react-pdf/renderer";
import type { AdvisorBrandingData } from "@/lib/validation/branding";
import { pdfDisplayNameFromBranding } from "@/lib/pdf/branding-integration";
import { AssessmentTranscriptDocument } from "@/lib/pdf/components/AssessmentTranscriptDocument";
import type { AssessmentPdfData } from "@/lib/pdf/assessment/build-assessment-pdf-data";

export interface RenderAssessmentPdfInput {
  data: AssessmentPdfData;
  branding?: AdvisorBrandingData | null;
}

export interface RenderAssessmentPdfResult {
  bytes: Uint8Array;
  fileName: string;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export async function renderAssessmentPdf(
  input: RenderAssessmentPdfInput,
): Promise<RenderAssessmentPdfResult> {
  const pdfBuffer = await renderToBuffer(
    <AssessmentTranscriptDocument data={input.data} branding={input.branding} />,
  );

  const brandSlug = slugify(pdfDisplayNameFromBranding(input.branding));
  const clientSlug = slugify(input.data.clientName) || "client";

  return {
    bytes: pdfBuffer as unknown as Uint8Array,
    fileName: `${brandSlug}-${clientSlug}-assessment-v${input.data.version}.pdf`,
  };
}

import { renderToBuffer } from "@react-pdf/renderer";
import type { AdvisorBrandingData } from "@/lib/validation/branding";
import { pdfDisplayNameFromBranding } from "@/lib/pdf/branding-integration";
import { IntakeTranscriptDocument } from "@/lib/pdf/components/IntakeTranscriptDocument";
import type { IntakePdfData } from "@/lib/pdf/intake/build-intake-pdf-data";

export interface RenderIntakePdfInput {
  data: IntakePdfData;
  branding?: AdvisorBrandingData | null;
}

export interface RenderIntakePdfResult {
  bytes: Uint8Array;
  fileName: string;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export async function renderIntakePdf(
  input: RenderIntakePdfInput,
): Promise<RenderIntakePdfResult> {
  const pdfBuffer = await renderToBuffer(
    <IntakeTranscriptDocument data={input.data} branding={input.branding} />,
  );

  const brandSlug = slugify(pdfDisplayNameFromBranding(input.branding));
  const clientSlug = slugify(input.data.clientName) || "client";

  return {
    bytes: pdfBuffer as unknown as Uint8Array,
    fileName: `${brandSlug}-${clientSlug}-intake-transcript.pdf`,
  };
}

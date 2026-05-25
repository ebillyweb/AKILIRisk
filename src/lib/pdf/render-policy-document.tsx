import { renderToBuffer } from "@react-pdf/renderer";
import type { TemplateData } from "@/lib/templates/types";
import type { AdvisorBrandingData } from "@/lib/validation/branding";
import { pdfDisplayNameFromBranding } from "@/lib/pdf/branding-integration";
import { PolicyDocument } from "@/lib/pdf/components/PolicyDocument";

export interface RenderPolicyDocumentInput {
  templateName: string;
  templateDescription: string;
  templateId: string;
  data: TemplateData;
  branding?: AdvisorBrandingData | null;
}

export interface RenderPolicyDocumentResult {
  bytes: Uint8Array;
  fileName: string;
}

export async function renderPolicyDocumentPdf(
  input: RenderPolicyDocumentInput
): Promise<RenderPolicyDocumentResult> {
  const pdfBuffer = await renderToBuffer(
    <PolicyDocument
      templateName={input.templateName}
      templateDescription={input.templateDescription}
      data={input.data}
      branding={input.branding}
    />
  );

  const brandSlug = pdfDisplayNameFromBranding(input.branding)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const familySlug = input.data.familyName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  return {
    bytes: pdfBuffer as unknown as Uint8Array,
    fileName: `${brandSlug}-${familySlug}-${input.templateId}-policy.pdf`,
  };
}

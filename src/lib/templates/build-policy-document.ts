import "server-only";

import { renderPolicyDocumentPdf } from "@/lib/pdf/render-policy-document";
import { generateTemplate } from "./generator";
import {
  generateBrandedTemplate,
  getBrandedDocumentFilename,
} from "./enhanced-generator";
import { preparePolicyDocument } from "./prepare-policy-document";
import type { TemplateId, TemplateMetadata } from "./types";

export type PolicyDocumentFormat = "docx" | "pdf";

export type BuildPolicyDocumentInput = {
  assessmentId: string;
  templateId: TemplateId;
  clientUserId: string;
  advisorProfileId: string | null;
  advisorView: boolean;
  format?: PolicyDocumentFormat;
};

export type BuildPolicyDocumentResult =
  | { ok: false; reason: "not_scored" }
  | {
      ok: true;
      buffer: Buffer;
      fileName: string;
      contentType: string;
    };

export async function buildPolicyDocument(
  input: BuildPolicyDocumentInput,
  templateMetadata: TemplateMetadata
): Promise<BuildPolicyDocumentResult> {
  const format = input.format ?? "docx";
  const prepared = await preparePolicyDocument(input, templateMetadata);

  if (!prepared.ok) {
    return { ok: false, reason: "not_scored" };
  }

  const { templateData, branding, templateMetadata: meta } = prepared;

  if (format === "pdf") {
    const useBranding = input.advisorProfileId && branding;
    const rendered = await renderPolicyDocumentPdf({
      templateName: meta.name,
      templateDescription: meta.description,
      templateId: input.templateId,
      data: templateData,
      branding: useBranding ? branding : null,
    });
    return {
      ok: true,
      buffer: Buffer.from(rendered.bytes),
      fileName: rendered.fileName,
      contentType: "application/pdf",
    };
  }

  let buffer: Buffer;
  let fileName: string;

  if (input.advisorProfileId && branding) {
    buffer = generateBrandedTemplate(input.templateId, templateData, branding);
    fileName = getBrandedDocumentFilename(
      input.templateId,
      templateData.familyName,
      branding
    );
  } else {
    buffer = generateTemplate(input.templateId, templateData);
    fileName = defaultPolicyFileName(meta, input.templateId);
  }

  return {
    ok: true,
    buffer,
    fileName,
    contentType:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  };
}

function defaultPolicyFileName(
  templateMetadata: TemplateMetadata,
  templateId: TemplateId
): string {
  return `${
    templateMetadata.name.toLowerCase().replace(/\s+/g, "-") || templateId
  }-policy.docx`;
}

import { NextRequest, NextResponse } from "next/server";
import {
  buildPolicyDocument,
  type PolicyDocumentFormat,
} from "@/lib/templates/build-policy-document";
import { resolvePolicyDocumentAccess } from "@/lib/templates/policy-document-access";
import { getAvailableTemplates } from "@/lib/templates/generator";
import { TemplateId, TEMPLATE_REGISTRY } from "@/lib/templates/types";

/**
 * Templates API Routes
 *
 * GET: Generate and download policy document from assessment pillar scores
 * Query params:
 * - template: TemplateId (required)
 * - format: docx | pdf (optional, default docx)
 * - all: boolean (optional) - JSON list of available templates
 *
 * Auth (US-62): assessment owner, active-assigned advisor, or admin.
 * Co-branded output (US-63) when advisor branding is enabled.
 */

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const templateParam = searchParams.get("template");
    const formatParam = searchParams.get("format");
    const showAll = searchParams.get("all") === "true";

    if (showAll) {
      return NextResponse.json({
        templates: getAvailableTemplates(),
      });
    }

    if (!templateParam) {
      return NextResponse.json(
        {
          error: "Template parameter required",
          availableTemplates: TEMPLATE_REGISTRY.map((t) => t.id),
        },
        { status: 400 }
      );
    }

    const format: PolicyDocumentFormat =
      formatParam === "pdf" ? "pdf" : "docx";

    if (formatParam && formatParam !== "docx" && formatParam !== "pdf") {
      return NextResponse.json(
        { error: "Invalid format. Use docx or pdf." },
        { status: 400 }
      );
    }

    const templateId = templateParam as TemplateId;
    const validTemplate = TEMPLATE_REGISTRY.find((t) => t.id === templateId);

    if (!validTemplate) {
      return NextResponse.json(
        {
          error: "Invalid template ID",
          availableTemplates: TEMPLATE_REGISTRY.map((t) => t.id),
        },
        { status: 400 }
      );
    }

    const access = await resolvePolicyDocumentAccess(id);
    if (!access.ok) {
      return NextResponse.json(
        {
          error:
            access.status === 401 ? "Not authenticated" : "Assessment not found",
        },
        { status: access.status }
      );
    }

    const built = await buildPolicyDocument(
      {
        assessmentId: id,
        templateId,
        clientUserId: access.clientUserId,
        advisorProfileId: access.advisorProfileId,
        advisorView: access.advisorView,
        format,
      },
      validTemplate
    );

    if (!built.ok) {
      return NextResponse.json(
        {
          error:
            "Assessment not scored for this pillar. Complete assessment to generate templates.",
        },
        { status: 404 }
      );
    }

    return new NextResponse(built.buffer as BodyInit, {
      headers: {
        "Content-Type": built.contentType,
        "Content-Disposition": `attachment; filename="${built.fileName}"`,
        "Cache-Control": "no-cache",
      },
    });
  } catch (error) {
    console.error("Error generating template:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

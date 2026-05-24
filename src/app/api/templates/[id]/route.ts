import { NextRequest, NextResponse } from "next/server";
import { getHouseholdProfileForClientAssessment } from "@/lib/household/member-profile";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { generateTemplate, getAvailableTemplates } from "@/lib/templates/generator";
import { mapAssessmentToTemplate } from "@/lib/templates/data-mapper";
import { TemplateId, TEMPLATE_REGISTRY } from "@/lib/templates/types";
import { ScoreResult } from "@/lib/assessment/types";

/**
 * Templates API Routes
 *
 * GET: Generate and download Word document template from assessment data
 * Query params:
 * - template: TemplateId (required) - which template to generate
 * - all: boolean (optional) - return JSON list of available templates instead
 */

/**
 * GET /api/templates/[id]
 * Generate Word document template from assessment score data
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();

    if (!session?.user?.id || !session?.user?.email) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const templateParam = searchParams.get('template');
    const showAll = searchParams.get('all') === 'true';

    // Return available templates if requested
    if (showAll) {
      return NextResponse.json({
        templates: getAvailableTemplates()
      });
    }

    // Validate template parameter
    if (!templateParam) {
      return NextResponse.json(
        {
          error: "Template parameter required",
          availableTemplates: TEMPLATE_REGISTRY.map(t => t.id)
        },
        { status: 400 }
      );
    }

    const templateId = templateParam as TemplateId;
    const validTemplate = TEMPLATE_REGISTRY.find(t => t.id === templateId);

    if (!validTemplate) {
      return NextResponse.json(
        {
          error: "Invalid template ID",
          availableTemplates: TEMPLATE_REGISTRY.map(t => t.id)
        },
        { status: 400 }
      );
    }

    // Verify assessment ownership
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

    // 404 on ownership mismatch (matches the no-such-assessment shape
    // above) so a caller can't probe for valid assessment ids.
    if (assessment.userId !== session.user.id) {
      return NextResponse.json(
        { error: "Assessment not found" },
        { status: 404 }
      );
    }

    // Load pillar score data
    const pillarScore = await prisma.pillarScore.findUnique({
      where: {
        assessmentId_pillar: {
          assessmentId: id,
          pillar: "family-governance",
        },
      },
    });

    if (!pillarScore) {
      return NextResponse.json(
        { error: "Assessment not scored. Complete assessment to generate templates." },
        { status: 404 }
      );
    }

    // Convert database score to ScoreResult format
    const scoreData: ScoreResult = {
      score: pillarScore.score,
      riskLevel: pillarScore.riskLevel.toLowerCase() as any,
      breakdown: pillarScore.breakdown as any,
      missingControls: pillarScore.missingControls as any,
    };

    const householdProfile = await getHouseholdProfileForClientAssessment(session.user.id);

    // Map assessment data to template data
    const templateData = mapAssessmentToTemplate(
      templateId,
      scoreData,
      session.user.email,
      householdProfile
    );

    // Generate Word document
    const documentBuffer = generateTemplate(templateId, templateData);

    // Set response headers for file download
    const templateMetadata = TEMPLATE_REGISTRY.find(t => t.id === templateId);
    const fileName = `${templateMetadata?.name.toLowerCase().replace(/\s+/g, '-') || templateId}-policy.docx`;

    return new NextResponse(documentBuffer as BodyInit, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Cache-Control': 'no-cache'
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
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { renderToBuffer } from "@react-pdf/renderer";
import { AssessmentReport } from "@/lib/pdf/components/AssessmentReport";
import { getAdvisorBrandingForPDF, createBrandedPDFMetadata } from "@/lib/pdf/branding-integration";
import { RELATIONSHIP_LABELS } from "@/lib/schemas/profile";

/**
 * PDF Report Generation API Route
 *
 * GET: Generate and download PDF report from assessment data
 */

interface CategoryScore {
  name: string;
  score: number;
  maxScore: number;
  subcategoryCount: number;
}

interface MissingControl {
  category: string;
  subcategory: string;
  description: string;
  recommendation: string;
  severity: 'high' | 'medium' | 'low';
}

/**
 * GET /api/reports/[id]/pdf
 * Generate PDF report for completed assessment
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 1. Auth check
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const requestedPillar = searchParams.get("pillar");

    // 2. Ownership check
    const assessment = await prisma.assessment.findUnique({
      where: { id },
      select: {
        userId: true,
        startedAt: true,
      },
    });

    // Load response count separately
    const responseCount = await prisma.assessmentResponse.count({
      where: {
        assessmentId: id,
        skipped: false,
      },
    });

    if (!assessment) {
      return NextResponse.json(
        { error: "Assessment not found" },
        { status: 404 }
      );
    }

    if (assessment.userId !== session.user.id) {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      );
    }

    // 3. Score check (allow explicit pillar, otherwise use most recently calculated)
    const pillarScore = requestedPillar
      ? await prisma.pillarScore.findUnique({
          where: {
            assessmentId_pillar: {
              assessmentId: id,
              pillar: requestedPillar,
            },
          },
        })
      : await prisma.pillarScore.findFirst({
          where: { assessmentId: id },
          orderBy: { calculatedAt: "desc" },
        });

    if (!pillarScore) {
      return NextResponse.json(
        {
          error: requestedPillar
            ? `No score found for pillar: ${requestedPillar}`
            : "Complete assessment to generate report",
        },
        { status: 404 }
      );
    }

    // 4. Load household members for household profile
    const householdMembers = await prisma.householdMember.findMany({
      where: { userId: session.user.id },
      select: {
        displayLabel: true,
        birthYear: true,
        sex: true,
        relationship: true,
        governanceRoles: true,
        isResident: true,
      },
    });

    // 5. Look up enhanced advisor branding for this client
    const clientAdvisorAssignment = await prisma.clientAdvisorAssignment.findFirst({
      where: {
        clientId: session.user.id,
        status: 'ACTIVE',
      },
      select: {
        advisorId: true,
        advisor: {
          select: {
            firmName: true,
            logoUrl: true,
          },
        },
      },
    });

    // Get enhanced branding data or fallback to legacy
    const advisorBranding = clientAdvisorAssignment?.advisorId
      ? await getAdvisorBrandingForPDF(clientAdvisorAssignment.advisorId)
      : null;

    // Legacy fallback for backward compatibility
    const legacyAdvisorBranding = clientAdvisorAssignment?.advisor ? {
      firmName: clientAdvisorAssignment.advisor.firmName || undefined,
      logoUrl: clientAdvisorAssignment.advisor.logoUrl || undefined,
    } : undefined;

    // 6. Calculate completion percentage
    const totalResponses = responseCount;
    // Estimate based on typical assessment size - in production would get from visible questions
    const estimatedTotalQuestions = 68; // Based on research findings
    const completionPercentage = Math.min(100, Math.round((totalResponses / estimatedTotalQuestions) * 100));

    // 7. Build household profile object — demographic-only shape
    // (Round-11 commit 2.2 / BRD §5.1 amendment). The PDF derives age
    // from birthYear at render time; we no longer ship a `fullName` or
    // pre-computed age into the renderer because those columns are gone.
    const householdProfile = householdMembers.length > 0 ? {
      members: householdMembers.map((m) => ({
        displayLabel: m.displayLabel,
        relationship: RELATIONSHIP_LABELS[m.relationship] ?? m.relationship,
        birthYear: m.birthYear ?? null,
        sex: m.sex ?? null,
        governanceRoles: m.governanceRoles as string[],
        isResident: m.isResident,
      })),
    } : undefined;

    // 8. Pre-process data into plain objects
    const breakdown = pillarScore.breakdown as unknown as CategoryScore[];
    const legacyMissingControls = pillarScore.missingControls as unknown as MissingControl[];

    const assessmentDate = assessment.startedAt.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    // Map Prisma enum to lowercase for consistency
    const riskLevel = pillarScore.riskLevel.toLowerCase();

    // Round-10 / B1 (BRD §4.3): pull every persisted pillar score for this
    // assessment so the heat-map page in the PDF shows the full per-domain
    // snapshot, not just the requested pillar. Empty array = legacy single-
    // pillar behavior (no heat map page rendered).
    const allPillarScoresForAssessment = await prisma.pillarScore.findMany({
      where: { assessmentId: id },
      select: { pillar: true, score: true, riskLevel: true },
    });

    // §4.5 commit 1: prefer AssessmentRecommendation rows (joined to the
    // ServiceRecommendation bank) over `pillarScore.missingControls`. The
    // bank-driven path surfaces `advisorNotes` per recommendation. Fall back
    // to the legacy JSONB column when no AssessmentRecommendation rows exist
    // (older assessments scored before the C1 rules engine landed) so older
    // PDFs don't suddenly render blank.
    const assessmentRecommendations = await prisma.assessmentRecommendation.findMany({
      where: { assessmentId: id },
      orderBy: { priority: "asc" },
      select: {
        priority: true,
        advisorNotes: true,
        serviceRecommendation: {
          select: {
            name: true,
            description: true,
            category: true,
          },
        },
      },
    });

    /** Map ServiceRecommendation.priority (Int, lower = more urgent) to the
     *  three-bucket severity the PDF renders. Mirrors the priority bands
     *  ServiceRecommendation seeds use today (1–3 high, 4–6 medium, 7+ low).
     *  Stays in sync with `RecommendationsSection`'s color palette. */
    const severityFromPriority = (priority: number): "high" | "medium" | "low" => {
      if (priority <= 3) return "high";
      if (priority <= 6) return "medium";
      return "low";
    };

    const missingControls: MissingControl[] = assessmentRecommendations.length > 0
      ? assessmentRecommendations.map((rec) => ({
          category: rec.serviceRecommendation.category,
          subcategory: rec.serviceRecommendation.name,
          // ServiceRecommendation has a single `description` field that
          // conflates issue + fix. Render it under the "Recommendation"
          // heading; surface a concise issue line keyed off category.
          description: `Gap identified in ${rec.serviceRecommendation.category}.`,
          recommendation: rec.serviceRecommendation.description,
          severity: severityFromPriority(rec.priority),
          advisorNotes: rec.advisorNotes ?? undefined,
        }))
      : legacyMissingControls.map((control) => ({
          category: control.category,
          subcategory: control.subcategory || control.category, // fallback if subcategory missing
          description: control.description,
          recommendation: control.recommendation,
          severity: control.severity,
          // Legacy JSONB rows have no `advisorNotes`; leave the field unset
          // so RecommendationsSection skips the callout entirely.
        }));

    const reportData = {
      score: pillarScore.score,
      riskLevel,
      breakdown: breakdown.map(cat => ({
        name: cat.name,
        score: cat.score,
        maxScore: cat.maxScore,
        subcategoryCount: breakdown.filter(b => b.name === cat.name).length || 1,
      })),
      missingControls,
      assessmentDate,
      completionPercentage,
      categoryCount: breakdown.length,
      missingControlsCount: missingControls.length,
      pillarScores: allPillarScoresForAssessment.map((p) => ({
        pillar: p.pillar,
        score: p.score,
        riskLevel: p.riskLevel,
      })),
    };

    // 9. Generate PDF with enhanced branding
    const pdfMetadata = createBrandedPDFMetadata(advisorBranding ?? undefined);

    const coverBranding =
      advisorBranding != null
        ? {
            firmName:
              advisorBranding.brandName ||
              advisorBranding.advisorFirmName ||
              undefined,
            logoUrl: advisorBranding.logoUrl ?? undefined,
          }
        : legacyAdvisorBranding;

    const pdfBuffer = await renderToBuffer(
      <AssessmentReport
        data={reportData}
        householdProfile={householdProfile}
        advisorBranding={coverBranding}
        documentMetadata={pdfMetadata}
      />
    );

    // 10. Return PDF with appropriate headers
    const brandName = advisorBranding?.brandName || advisorBranding?.advisorFirmName || legacyAdvisorBranding?.firmName || 'akili-risk';
    const firmSlug = brandName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    const pillarSlug = pillarScore.pillar
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    return new NextResponse(pdfBuffer as unknown as BodyInit, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${firmSlug}-${pillarSlug}-report.pdf"`,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
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
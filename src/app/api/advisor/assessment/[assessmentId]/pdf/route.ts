import { NextRequest, NextResponse } from "next/server";
import { isAdvisorAuthError } from "@/lib/advisor/auth";
import { getAssessmentForAdvisorExport } from "@/lib/advisor/assessment-review-queries";
import { getAdvisorBrandingForPDF } from "@/lib/pdf/branding-integration";
import {
  buildAssessmentPdfData,
  isAssessmentExportableStatus,
} from "@/lib/pdf/assessment/build-assessment-pdf-data";
import { renderAssessmentPdf } from "@/lib/pdf/render-assessment-pdf";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ assessmentId: string }> },
) {
  try {
    const { assessmentId } = await params;
    const review = await getAssessmentForAdvisorExport(assessmentId);
    if (!review) {
      return NextResponse.json({ error: "Assessment not found" }, { status: 404 });
    }

    if (!isAssessmentExportableStatus(review.assessment.status)) {
      return NextResponse.json(
        { error: "Assessment must be completed before export" },
        { status: 403 },
      );
    }

    const branding = await getAdvisorBrandingForPDF(
      review.assignmentAdvisorProfileId,
    );
    const pdfData = buildAssessmentPdfData(review);
    const { bytes, fileName } = await renderAssessmentPdf({
      data: pdfData,
      branding,
    });

    return new NextResponse(bytes as unknown as BodyInit, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control": "no-cache, no-store, must-revalidate",
        Pragma: "no-cache",
        Expires: "0",
      },
    });
  } catch (error) {
    if (isAdvisorAuthError(error)) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Unauthorized" },
        { status: 401 },
      );
    }
    console.error("Error rendering assessment PDF:", error);
    return NextResponse.json(
      { error: "Failed to render assessment transcript" },
      { status: 500 },
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { isAdvisorAuthError } from "@/lib/advisor/auth";
import { getIntakeReviewDataForAdvisorExport } from "@/lib/advisor/intake-review-queries";
import { getAdvisorBrandingForPDF } from "@/lib/pdf/branding-integration";
import {
  buildIntakePdfData,
  isIntakeExportableStatus,
} from "@/lib/pdf/intake/build-intake-pdf-data";
import { renderIntakePdf } from "@/lib/pdf/render-intake-pdf";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ interviewId: string }> },
) {
  try {
    const { interviewId } = await params;
    const review = await getIntakeReviewDataForAdvisorExport(interviewId);
    if (!review) {
      return NextResponse.json({ error: "Intake not found" }, { status: 404 });
    }

    if (!isIntakeExportableStatus(review.interview.status)) {
      return NextResponse.json(
        { error: "Intake must be submitted before export" },
        { status: 403 },
      );
    }

    const branding = await getAdvisorBrandingForPDF(
      review.assignmentAdvisorProfileId,
    );
    const pdfData = buildIntakePdfData(review);
    const { bytes, fileName } = await renderIntakePdf({
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
    console.error("Error rendering intake PDF:", error);
    return NextResponse.json(
      { error: "Failed to render intake transcript" },
      { status: 500 },
    );
  }
}

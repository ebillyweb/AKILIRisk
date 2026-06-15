import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { AdvisorAssessmentReviewView } from "@/components/advisor/AdvisorAssessmentReviewView";
import { ExportAssessmentPdfButton } from "@/components/advisor/ExportAssessmentPdfButton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getAssessmentForAdvisorReview } from "@/lib/advisor/assessment-review-queries";
import { isAssessmentExportableStatus } from "@/lib/pdf/assessment/build-assessment-pdf-data";

/**
 * US-46c: advisor surface for reviewing individual assessment answers and
 * attaching per-answer advisory notes. Tenant-isolated through the
 * `getAssessmentForAdvisorReview` query — returns `null` (and we 404)
 * unless the assessment owner has an ACTIVE assignment to the calling
 * advisor.
 */
export default async function AdvisorAssessmentReviewPage({
  params,
}: {
  params: Promise<{ clientId: string; assessmentId: string }>;
}) {
  const { clientId, assessmentId } = await params;

  const data = await getAssessmentForAdvisorReview(assessmentId);
  if (!data) notFound();

  // Defense-in-depth: confirm the assessment we resolved actually belongs
  // to the clientId in the URL. The tenant gate above also covers this,
  // but the URL pair could disagree if a bookmark went stale.
  if (data.assessment.user.id !== clientId) notFound();

  const { assessment } = data;
  const canExportPdf = isAssessmentExportableStatus(assessment.status);
  const completedLabel = assessment.completedAt
    ? new Intl.DateTimeFormat("en-US", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(assessment.completedAt))
    : "In progress";

  return (
    <div className="container mx-auto space-y-6 py-6" data-testid="advisor-assessment-review-page">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="outline" size="sm" asChild>
          <Link
            href={`/advisor/pipeline/${clientId}`}
            className="inline-flex items-center gap-2"
          >
            <ArrowLeft className="size-4" aria-hidden />
            Back to client
          </Link>
        </Button>
        {canExportPdf ? (
          <ExportAssessmentPdfButton assessmentId={assessment.id} />
        ) : null}
        <Badge variant="outline">{assessment.status}</Badge>
        <span className="text-xs text-muted-foreground">v{assessment.version}</span>
      </div>

      <div className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight">
          {assessment.user.name ?? assessment.user.email}
        </h1>
        <p className="text-sm text-muted-foreground">{assessment.user.email}</p>
        <p className="text-sm text-muted-foreground">{completedLabel}</p>
      </div>

      <p className="text-sm text-muted-foreground">
        Review assessment answers and attach advisor notes. Notes are private
        to you and platform staff and do not affect maturity scores or pillar
        results.
      </p>

      <AdvisorAssessmentReviewView data={data} />
    </div>
  );
}

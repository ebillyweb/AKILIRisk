import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { AdminAssessmentReviewView } from "@/components/admin/AdminAssessmentReviewView";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getAssessmentForAdminReview } from "@/lib/admin/assessment-review-queries";

export default async function AdminAssessmentReviewPage({
  params,
}: {
  params: Promise<{ assessmentId: string }>;
}) {
  const { assessmentId } = await params;
  const data = await getAssessmentForAdminReview(assessmentId);
  if (!data) notFound();

  const { assessment } = data;
  const completedLabel = assessment.completedAt
    ? new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(
        new Date(assessment.completedAt)
      )
    : "In progress";

  return (
    <div className="space-y-6" data-testid="admin-assessment-review-page">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="outline" size="sm" asChild>
          <Link href="/admin/assessment" className="inline-flex items-center gap-2">
            <ArrowLeft className="size-4" aria-hidden />
            Assessments
          </Link>
        </Button>
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
        Review assessment answers and attach platform-admin notes. Notes are advisory only and
        do not affect maturity scores or pillar results.
      </p>

      <AdminAssessmentReviewView data={data} />
    </div>
  );
}

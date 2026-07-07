import Link from "next/link";
import { ListChecks } from "lucide-react";
import { requireAdminRole } from "@/lib/admin/auth";
import { getAssessmentsForAdmin } from "@/lib/admin/queries";
import { ADMIN_ASSESSMENT_QUESTIONS_PATH } from "@/lib/admin/assessment-questions-paths";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AssessmentRescoreButton } from "@/components/admin/AssessmentRescoreButton";
import { assessmentNeedsRescore } from "@/lib/assessment/answers-changed-after-complete";

const STATUS_COLORS: Record<string, "default" | "secondary" | "success" | "warning" | "info" | "outline"> = {
  IN_PROGRESS: "secondary",
  COMPLETED: "success",
  ARCHIVED: "outline",
};

export default async function AdminAssessmentPage() {
  await requireAdminRole();
  const assessments = await getAssessmentsForAdmin();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-col gap-3 space-y-0 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <CardTitle className="text-base">Assessment questions</CardTitle>
            <CardDescription>
              Create, edit, hide, and reorder personal risk profile questions by risk area.
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" className="shrink-0" asChild>
            <Link
              href={ADMIN_ASSESSMENT_QUESTIONS_PATH}
              className="inline-flex items-center gap-2"
            >
              <ListChecks className="size-4" aria-hidden />
              Manage assessment questions
            </Link>
          </Button>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Assessments ({assessments.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {assessments.length === 0 ? (
            <p className="text-sm text-muted-foreground">No assessments found.</p>
          ) : (
            <ul className="divide-y divide-border">
              {assessments.map((a) => (
                <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                  <div>
                    <p className="font-medium">{a.user.name ?? a.user.email}</p>
                    <p className="text-sm text-muted-foreground">{a.user.email}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      v{a.version} · {a._count.responses} responses · {a._count.scores} scores
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/admin/assessment/${a.id}`}>Review answers</Link>
                    </Button>
                    <Badge variant={STATUS_COLORS[a.status] ?? "outline"}>{a.status}</Badge>
                    {assessmentNeedsRescore({
                      status: a.status,
                      answersChangedAfterCompleteAt: a.answersChangedAfterCompleteAt,
                    }) ? (
                      <AssessmentRescoreButton assessmentId={a.id} />
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

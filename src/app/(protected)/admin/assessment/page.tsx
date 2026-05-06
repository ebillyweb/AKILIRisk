import { requireAdminRole } from "@/lib/admin/auth";
import { getAssessmentsForAdmin } from "@/lib/admin/queries";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AssessmentRescoreButton } from "@/components/admin/AssessmentRescoreButton";

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
      <div>
        <h1 className="text-2xl font-bold">Assessments</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Per-assessment view. Use the Rescore button on completed
          assessments to re-run scoring under current rules + thresholds
          (BRD §7.2). Prior scores are preserved in the audit log.
        </p>
      </div>
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
                  <div className="flex items-center gap-3">
                    <Badge variant={STATUS_COLORS[a.status] ?? "outline"}>{a.status}</Badge>
                    {a.status === "COMPLETED" && a._count.scores > 0 ? (
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

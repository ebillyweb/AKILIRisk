import { getClientsForAdmin } from "@/lib/admin/queries";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DownloadReportButton } from "@/components/reports/DownloadReportButton";

export default async function AdminClientsPage() {
  const clients = await getClientsForAdmin();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Client accounts ({clients.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {clients.length === 0 ? (
            <p className="text-sm text-muted-foreground">No clients found.</p>
          ) : (
            <ul className="divide-y divide-border">
              {clients.map((c) => {
                const activeAssignments = c.clientAssignments.filter((a) => a.status === "ACTIVE");
                return (
                  <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-3 first:pt-0 last:pb-0">
                    <div>
                      <p className="font-medium">{c.name ?? c.email}</p>
                      <p className="text-sm text-muted-foreground">{c.email}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {c._count.intakeInterviews} intake(s) · {c._count.assessments} assessment(s)
                        {activeAssignments.length > 0 &&
                          ` · ${activeAssignments.map((a) => a.advisor.user.email).join(", ")}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {/* §4.5 commit 2: admin role is allowlisted for PDF
                          download; rendered only when the client has a
                          scored assessment to render. */}
                      {c.latestScoredAssessmentId && (
                        <DownloadReportButton
                          assessmentId={c.latestScoredAssessmentId}
                          clientLabel={c.name || c.email}
                          label="Download report"
                          variant="ghost"
                        />
                      )}
                      {activeAssignments.length > 0 ? (
                        <Badge variant="secondary">{activeAssignments.length} advisor(s)</Badge>
                      ) : (
                        <Badge variant="outline">Unassigned</Badge>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

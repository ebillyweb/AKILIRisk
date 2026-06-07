import Link from "next/link";
import { Files } from "lucide-react";

import { getClientsForAdmin, type ClientsAdminScope } from "@/lib/admin/queries";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DownloadReportButton } from "@/components/reports/DownloadReportButton";
import { AdminClientAccountActions } from "@/components/admin/AdminClientAccountActions";
import { cn } from "@/lib/utils";

export default async function AdminClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const sp = await searchParams;
  const scope: ClientsAdminScope = sp.filter === "all" ? "all" : "active";
  const clients = await getClientsForAdmin({ scope });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <h1 className="text-lg font-semibold tracking-tight">
            Client accounts{" "}
            <span className="font-normal text-muted-foreground">({clients.length})</span>
          </h1>
          <div className="flex flex-wrap gap-2 text-sm">
            <Button variant={scope === "active" ? "default" : "outline"} size="sm" className="h-8" asChild>
              <Link href="/admin/clients">Active</Link>
            </Button>
            <Button variant={scope === "all" ? "default" : "outline"} size="sm" className="h-8" asChild>
              <Link href="/admin/clients?filter=all">All</Link>
            </Button>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Clients</CardTitle>
        </CardHeader>
        <CardContent>
          {clients.length === 0 ? (
            <p className="text-sm text-muted-foreground">No clients found.</p>
          ) : (
            <ul className="divide-y divide-border">
              {clients.map((c) => {
                const activeAssignments = c.clientAssignments.filter((a) => a.status === "ACTIVE");
                const isDeactivated = Boolean(c.deletedAt);
                return (
                  <li
                    key={c.id}
                    className={cn(
                      "space-y-3 py-3 first:pt-0 last:pb-0",
                      isDeactivated && "opacity-80",
                    )}
                  >
                    <div className="min-w-0">
                      <p className="font-medium">{c.name ?? c.email}</p>
                      <p className="truncate text-sm text-muted-foreground">{c.email}</p>
                      <p className="mt-1 truncate text-xs text-muted-foreground">
                        {c._count.intakeInterviews} intake(s) · {c._count.assessments} assessment(s)
                        {activeAssignments.length > 0 &&
                          ` · ${activeAssignments.map((a) => a.advisor.user.email).join(", ")}`}
                      </p>
                      {isDeactivated ? (
                        <Badge variant="secondary" className="mt-2 text-xs">
                          Deactivated
                        </Badge>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {c.latestScoredAssessmentId ? (
                        <>
                          {/* §4.5 commit 3: link to the per-version reports
                              page (republish + audit history live there). The
                              inline download remains as a quick latest-PUBLISHED
                              shortcut. */}
                          <Button variant="ghost" size="sm" asChild>
                            <Link href={`/admin/clients/${c.id}/reports`}>
                              <Files className="w-4 h-4 mr-2" />
                              Reports
                            </Link>
                          </Button>
                          <DownloadReportButton
                            assessmentId={c.latestScoredAssessmentId}
                            clientLabel={c.name || c.email}
                            label="Download"
                            variant="ghost"
                            size="sm"
                          />
                        </>
                      ) : null}
                      <div className="ml-auto flex shrink-0 items-center gap-2">
                        {activeAssignments.length > 0 ? (
                          <Badge
                            variant="secondary"
                            className="whitespace-nowrap normal-case tracking-normal"
                          >
                            {activeAssignments.length} advisor
                            {activeAssignments.length === 1 ? "" : "s"}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="whitespace-nowrap normal-case tracking-normal">
                            Unassigned
                          </Badge>
                        )}
                        <AdminClientAccountActions clientId={c.id} deactivated={isDeactivated} />
                      </div>
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

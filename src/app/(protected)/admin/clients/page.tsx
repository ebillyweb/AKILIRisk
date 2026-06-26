import Link from "next/link";
import { Files } from "lucide-react";

import { auth } from "@/lib/auth";
import { isSuperAdmin } from "@/lib/admin/auth";
import { getClientAssignmentTargetsForAdmin } from "@/lib/admin/client-assignment-queries";
import { getClientsForAdmin, type ClientsAdminScope } from "@/lib/admin/queries";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DownloadReportButton } from "@/components/reports/DownloadReportButton";
import { AdminClientAccountActions } from "@/components/admin/AdminClientAccountActions";
import { AdminClientAssignSelect } from "@/components/admin/AdminClientAssignSelect";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 20;

function toPositiveInt(raw: string | undefined, fallback: number): number {
  if (!raw) return fallback;
  const value = Number.parseInt(raw, 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function clientsPageHref(scope: ClientsAdminScope, page: number): string {
  const sp = new URLSearchParams();
  if (scope === "all") sp.set("filter", "all");
  if (page > 1) sp.set("page", String(page));
  const query = sp.toString();
  return `/admin/clients${query ? `?${query}` : ""}`;
}

export default async function AdminClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const scope: ClientsAdminScope = sp.filter === "all" ? "all" : "active";
  const requestedPage = toPositiveInt(sp.page, 1);
  const session = await auth();
  const superUser = isSuperAdmin(session);
  const [clientsResult, assignmentTargetGroups] = await Promise.all([
    getClientsForAdmin({
      scope,
      page: requestedPage,
      pageSize: PAGE_SIZE,
    }),
    superUser ? getClientAssignmentTargetsForAdmin() : Promise.resolve([]),
  ]);
  const { clients, totalCount, page: currentPage, pageSize } = clientsResult;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const hasNextPage = currentPage * pageSize < totalCount;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <h1 className="text-lg font-semibold tracking-tight">
            Client accounts{" "}
            <span className="font-normal text-muted-foreground">({totalCount.toLocaleString()})</span>
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
                            clientLabel={c.name ?? c.email ?? undefined}
                            label="Download"
                            variant="ghost"
                            size="sm"
                          />
                        </>
                      ) : null}
                      <div className="ml-auto flex shrink-0 flex-wrap items-center justify-end gap-2">
                        {activeAssignments.length > 0 ? (
                          <Badge
                            variant="secondary"
                            className="whitespace-nowrap normal-case tracking-normal"
                          >
                            {activeAssignments.length} advisor
                            {activeAssignments.length === 1 ? "" : "s"}
                          </Badge>
                        ) : superUser && !isDeactivated ? (
                          <AdminClientAssignSelect
                            clientId={c.id}
                            targetGroups={assignmentTargetGroups}
                          />
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

      {totalCount > 0 ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            Page {currentPage.toLocaleString()} of {totalPages.toLocaleString()}
            {" · "}
            Showing {(currentPage - 1) * pageSize + 1}–
            {Math.min(currentPage * pageSize, totalCount).toLocaleString()} of{" "}
            {totalCount.toLocaleString()}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {currentPage > 1 ? (
              <Button variant="outline" size="sm" asChild>
                <Link href={clientsPageHref(scope, currentPage - 1)}>← Previous page</Link>
              </Button>
            ) : null}
            {hasNextPage ? (
              <Button variant="outline" size="sm" asChild>
                <Link href={clientsPageHref(scope, currentPage + 1)}>Next page →</Link>
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

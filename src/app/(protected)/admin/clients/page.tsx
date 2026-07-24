import Link from "next/link";
import { Files, Search, X } from "lucide-react";

import { auth } from "@/lib/auth";
import { isSuperAdmin } from "@/lib/admin/auth";
import { getClientAssignmentTargetsForAdmin } from "@/lib/admin/client-assignment-queries";
import { getClientsForAdmin, getAdvisorsForClientFilter, type ClientsAdminScope } from "@/lib/admin/queries";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DownloadReportButton } from "@/components/reports/DownloadReportButton";
import { AdminClientAccountActions } from "@/components/admin/AdminClientAccountActions";
import { AdminClientAssignSelect } from "@/components/admin/AdminClientAssignSelect";
import { AdminTestAccountToggle } from "@/components/admin/AdminTestAccountToggle";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 20;

function toPositiveInt(raw: string | undefined, fallback: number): number {
  if (!raw) return fallback;
  const value = Number.parseInt(raw, 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function clientsPageHref(
  scope: ClientsAdminScope,
  page: number,
  q?: string,
  advisorId?: string
): string {
  const sp = new URLSearchParams();
  if (scope === "all") sp.set("filter", "all");
  if (page > 1) sp.set("page", String(page));
  if (q?.trim()) sp.set("q", q.trim());
  if (advisorId?.trim()) sp.set("advisor", advisorId.trim());
  const query = sp.toString();
  return `/admin/clients${query ? `?${query}` : ""}`;
}

export default async function AdminClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; page?: string; q?: string; advisor?: string }>;
}) {
  const sp = await searchParams;
  const scope: ClientsAdminScope = sp.filter === "all" ? "all" : "active";
  const requestedPage = toPositiveInt(sp.page, 1);
  const query = sp.q?.trim() ?? "";
  const advisorFilter = sp.advisor?.trim() ?? "";
  const session = await auth();
  const superUser = isSuperAdmin(session);
  const [clientsResult, assignmentTargetGroups, advisorOptions] = await Promise.all([
    getClientsForAdmin({
      scope,
      page: requestedPage,
      pageSize: PAGE_SIZE,
      q: query || undefined,
      advisorId: advisorFilter || undefined,
    }),
    superUser ? getClientAssignmentTargetsForAdmin() : Promise.resolve([]),
    getAdvisorsForClientFilter(),
  ]);
  const { clients, totalCount, page: currentPage, pageSize } = clientsResult;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const hasNextPage = currentPage * pageSize < totalCount;
  const hasActiveSearch = Boolean(query);
  const hasAdvisorFilter = Boolean(advisorFilter);
  const selectedAdvisor = advisorOptions.find((a) => a.id === advisorFilter);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <h1 className="text-lg font-semibold tracking-tight">
            Client accounts{" "}
            <span className="font-normal text-muted-foreground">({totalCount.toLocaleString()})</span>
          </h1>
          <div className="flex flex-wrap gap-2 text-sm">
            <Button variant={scope === "active" ? "default" : "outline"} size="sm" className="h-8" asChild>
              <Link href={clientsPageHref("active", 1, query, advisorFilter)}>Active</Link>
            </Button>
            <Button variant={scope === "all" ? "default" : "outline"} size="sm" className="h-8" asChild>
              <Link href={clientsPageHref("all", 1, query, advisorFilter)}>All</Link>
            </Button>
          </div>
        </div>
        <div className="flex w-full flex-col gap-3 lg:max-w-2xl">
          {/* Advisor filter */}
          <div className="flex items-center gap-2">
            <label className="shrink-0 text-sm text-muted-foreground">Team Member:</label>
            <div className="flex-1">
              {hasAdvisorFilter ? (
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="h-8 px-3 text-sm normal-case tracking-normal">
                    {selectedAdvisor?.firmName || selectedAdvisor?.userName || selectedAdvisor?.email || "Unknown"}
                    <span className="ml-1 text-muted-foreground">({selectedAdvisor?.activeClientCount ?? 0})</span>
                  </Badge>
                  <Button variant="ghost" size="sm" className="h-8 px-2" asChild>
                    <Link href={clientsPageHref(scope, 1, query)} aria-label="Clear advisor filter">
                      <X className="size-4" />
                    </Link>
                  </Button>
                </div>
              ) : advisorOptions.length > 0 ? (
                <form method="GET" className="w-full max-w-xs">
                  {scope === "all" && <input type="hidden" name="filter" value="all" />}
                  {query && <input type="hidden" name="q" value={query} />}
                  <Select name="advisor" onValueChange={(v) => {
                    window.location.href = clientsPageHref(scope, 1, query, v);
                  }}>
                    <SelectTrigger className="h-8">
                      <SelectValue placeholder="All advisors" />
                    </SelectTrigger>
                    <SelectContent>
                      {advisorOptions.map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.firmName || a.userName || a.email} ({a.activeClientCount})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </form>
              ) : (
                <span className="text-sm text-muted-foreground">No advisors with clients</span>
              )}
            </div>
          </div>

          {/* Search */}
          <form method="GET" className="flex w-full flex-col gap-2 sm:flex-row">
            {scope === "all" ? <input type="hidden" name="filter" value="all" /> : null}
            {advisorFilter ? <input type="hidden" name="advisor" value={advisorFilter} /> : null}
            <div className="relative min-w-0 flex-1">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <Input
                name="q"
                defaultValue={query}
                placeholder="Search name, ID, or email"
                className="h-9 pl-9"
                aria-label="Search clients by name, ID, or email"
              />
            </div>
            <div className="flex gap-2">
              <Button type="submit" size="sm" className="h-9">
                Search
              </Button>
              {hasActiveSearch ? (
                <Button variant="ghost" size="sm" className="h-9" asChild>
                  <Link href={clientsPageHref(scope, 1, undefined, advisorFilter)}>Clear search</Link>
                </Button>
              ) : null}
            </div>
          </form>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Clients</CardTitle>
        </CardHeader>
        <CardContent>
          {clients.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {hasActiveSearch ? "No clients match your search." : "No clients found."}
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {clients.map((c) => {
                const activeAssignments = c.clientAssignments.filter((a) => a.status === "ACTIVE");
                const isDeactivated = Boolean(c.deletedAt);
                const isTestAccount = Boolean(c.isTestAccount);
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
                      {isTestAccount ? (
                        <Badge variant="secondary" className="mt-2 text-xs">
                          Test account
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
                        {superUser ? (
                          <AdminTestAccountToggle
                            userId={c.id}
                            isTestAccount={isTestAccount}
                            accountLabel="client"
                          />
                        ) : null}
                        <AdminClientAccountActions clientId={c.id} deactivated={isDeactivated} isSuperAdmin={superUser} />
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
                <Link href={clientsPageHref(scope, currentPage - 1, query, advisorFilter)}>← Previous page</Link>
              </Button>
            ) : null}
            {hasNextPage ? (
              <Button variant="outline" size="sm" asChild>
                <Link href={clientsPageHref(scope, currentPage + 1, query, advisorFilter)}>Next page →</Link>
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

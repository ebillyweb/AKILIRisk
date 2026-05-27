import Link from "next/link";
import { format } from "date-fns";
import { FileDown, FileText, History, Search } from "lucide-react";
import type { Prisma, ReportStatus } from "@prisma/client";

import { requireAdminRole } from "@/lib/admin/auth";
import { prisma } from "@/lib/db";
import { decryptUserEmail } from "@/lib/auth/user-email";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type ReportStatusFilter = "ALL" | ReportStatus;
const PAGE_SIZE = 25;

const STATUS_FILTERS: Array<{ value: ReportStatusFilter; label: string }> = [
  { value: "ALL", label: "All" },
  { value: "PUBLISHED", label: "Published" },
  { value: "DRAFT", label: "Drafts" },
  { value: "SUPERSEDED", label: "Superseded" },
];

function toStatusFilter(value: string | undefined): ReportStatusFilter {
  if (value === "PUBLISHED" || value === "DRAFT" || value === "SUPERSEDED") {
    return value;
  }
  return "ALL";
}

function toSingle(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function parseDateInput(raw: string | undefined): Date | null {
  if (!raw) return null;
  const normalized = raw.length === 10 ? `${raw}T00:00:00.000Z` : raw;
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function toDateInputValue(date: Date | null): string {
  if (!date) return "";
  return date.toISOString().slice(0, 10);
}

function toPositiveInt(raw: string | undefined, fallback: number): number {
  if (!raw) return fallback;
  const value = Number.parseInt(raw, 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function withParams(params: {
  status: ReportStatusFilter;
  q: string;
  from: string;
  to: string;
  page: number;
}): string {
  const sp = new URLSearchParams();
  sp.set("status", params.status);
  if (params.q) sp.set("q", params.q);
  if (params.from) sp.set("from", params.from);
  if (params.to) sp.set("to", params.to);
  if (params.page > 1) sp.set("page", String(params.page));
  const query = sp.toString();
  return `/admin/reports${query ? `?${query}` : ""}`;
}

function exportHref(params: {
  status: ReportStatusFilter;
  q: string;
  from: string;
  to: string;
}): string {
  const sp = new URLSearchParams();
  if (params.status !== "ALL") sp.set("status", params.status);
  if (params.q) sp.set("q", params.q);
  if (params.from) sp.set("from", params.from);
  if (params.to) sp.set("to", params.to);
  const query = sp.toString();
  return `/api/admin/reports/export${query ? `?${query}` : ""}`;
}

export default async function AdminReportsPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string | string[];
    q?: string | string[];
    from?: string | string[];
    to?: string | string[];
    page?: string | string[];
  }>;
}) {
  await requireAdminRole();
  const sp = await searchParams;

  const status = toStatusFilter(toSingle(sp.status));
  const query = (toSingle(sp.q) ?? "").trim();
  const fromInput = toSingle(sp.from) ?? "";
  const toInput = toSingle(sp.to) ?? "";
  const page = toPositiveInt(toSingle(sp.page), 1);

  const fromDate = parseDateInput(fromInput);
  const toDateRaw = parseDateInput(toInput);
  const toDate = toDateRaw
    ? new Date(Date.UTC(
        toDateRaw.getUTCFullYear(),
        toDateRaw.getUTCMonth(),
        toDateRaw.getUTCDate(),
        23,
        59,
        59,
        999
      ))
    : null;

  const baseWhere: Prisma.ReportWhereInput = {
    ...(fromDate || toDate
      ? {
          createdAt: {
            ...(fromDate ? { gte: fromDate } : {}),
            ...(toDate ? { lte: toDate } : {}),
          },
        }
      : {}),
    ...(query
      ? {
          OR: [
            { id: { contains: query, mode: "insensitive" } },
            { assessmentId: { contains: query, mode: "insensitive" } },
            {
              assessment: {
                user: {
                  name: { contains: query, mode: "insensitive" },
                },
              },
            },
          ],
        }
      : {}),
  };

  const where: Prisma.ReportWhereInput = {
    ...baseWhere,
    ...(status === "ALL" ? {} : { status }),
  };

  const [rows, grouped, totalMatching] = await Promise.all([
    prisma.report.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        assessmentId: true,
        version: true,
        status: true,
        templateChoice: true,
        publishedAt: true,
        createdAt: true,
        assessment: {
          select: {
            userId: true,
            user: {
              select: {
                name: true,
                emailCiphertext: true,
              },
            },
          },
        },
      },
    }),
    prisma.report.groupBy({
      by: ["status"],
      _count: { _all: true },
      where: baseWhere,
    }),
    prisma.report.count({ where }),
  ]);

  const counts = {
    ALL: grouped.reduce((sum, row) => sum + row._count._all, 0),
    PUBLISHED: grouped.find((row) => row.status === "PUBLISHED")?._count._all ?? 0,
    DRAFT: grouped.find((row) => row.status === "DRAFT")?._count._all ?? 0,
    SUPERSEDED: grouped.find((row) => row.status === "SUPERSEDED")?._count._all ?? 0,
  } as const;
  const hasNextPage = page * PAGE_SIZE < totalMatching;
  const totalPages = Math.max(1, Math.ceil(totalMatching / PAGE_SIZE));
  const fromValue = toDateInputValue(fromDate);
  const toValue = toDateInputValue(toDateRaw);
  const hasActiveFilters = Boolean(
    query || fromValue || toValue || status !== "ALL" || page > 1
  );

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-lg font-semibold tracking-tight">
          Intelligence reports{" "}
          <span className="font-normal text-muted-foreground">({counts[status]})</span>
        </h1>
        <p className="text-sm text-muted-foreground">
          Cross-client report history for admin oversight. Download immutable versions,
          inspect audit history, and jump to client-level report timelines.
        </p>
        <p className="text-xs text-muted-foreground">
          Showing {rows.length.toLocaleString()} of {totalMatching.toLocaleString()} matching
          reports.
        </p>
      </div>

      <Card>
        <CardHeader className="space-y-4">
          <CardTitle className="text-base">Filters</CardTitle>
          <form className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="flex flex-wrap gap-2">
              {STATUS_FILTERS.map((opt) => (
                <Button
                  key={opt.value}
                  variant={status === opt.value ? "default" : "outline"}
                  size="sm"
                  className="h-8"
                  asChild
                >
                  <Link
                    href={
                      withParams({
                        status: opt.value,
                        q: query,
                        from: fromValue,
                        to: toValue,
                        page: 1,
                      })
                    }
                  >
                    {opt.label}
                    <span className="ml-1 text-xs text-muted-foreground">
                      ({counts[opt.value]})
                    </span>
                  </Link>
                </Button>
              ))}
            </div>
            <div className="flex w-full max-w-xl items-center gap-2 lg:ml-auto">
              <Search className="size-4 text-muted-foreground" />
              <Input
                name="q"
                defaultValue={query}
                placeholder="Search by client name, report ID, or assessment ID"
                className="h-9"
              />
              <Input
                type="date"
                name="from"
                defaultValue={fromValue}
                className="h-9 w-[10.5rem]"
                aria-label="From date"
              />
              <Input
                type="date"
                name="to"
                defaultValue={toValue}
                className="h-9 w-[10.5rem]"
                aria-label="To date"
              />
              <input type="hidden" name="status" value={status} />
              <input type="hidden" name="page" value="1" />
              <Button type="submit" size="sm">
                Search
              </Button>
              {hasActiveFilters ? (
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/admin/reports">Clear filters</Link>
                </Button>
              ) : null}
              <Button variant="outline" size="sm" asChild>
                <a href={exportHref({ status, q: query, from: fromValue, to: toValue })} download>
                  Export CSV
                </a>
              </Button>
            </div>
          </form>
        </CardHeader>
        <CardContent>
          {hasActiveFilters ? (
            <div className="mb-4 flex flex-wrap gap-2">
              <Badge variant="outline" className="text-xs">
                Status: {status}
              </Badge>
              {query ? (
                <Badge variant="outline" className="text-xs">
                  Search: {query}
                </Badge>
              ) : null}
              {fromValue ? (
                <Badge variant="outline" className="text-xs">
                  From: {fromValue}
                </Badge>
              ) : null}
              {toValue ? (
                <Badge variant="outline" className="text-xs">
                  To: {toValue}
                </Badge>
              ) : null}
              {page > 1 ? (
                <Badge variant="outline" className="text-xs">
                  Page: {page}
                </Badge>
              ) : null}
            </div>
          ) : null}
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No reports match this filter.</p>
          ) : (
            <ul className="divide-y divide-border">
              {rows.map((row) => {
                const clientName = row.assessment.user.name?.trim() || null;
                const clientEmail = decryptUserEmail(row.assessment.user.emailCiphertext);
                const clientLabel = clientName || clientEmail;
                const statusVariant: "outline" | "success" | "secondary" =
                  row.status === "PUBLISHED"
                    ? "success"
                    : row.status === "DRAFT"
                      ? "outline"
                      : "secondary";

                return (
                  <li
                    key={row.id}
                    className="space-y-3 py-4 first:pt-0 last:pb-0"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">{clientLabel}</span>
                          <Badge variant={statusVariant}>{row.status}</Badge>
                          <Badge variant="outline" className="text-xs">
                            v{row.version}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {row.templateChoice}
                          </Badge>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Report {row.id} · Assessment {row.assessmentId}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {row.publishedAt
                            ? `Published ${format(row.publishedAt, "MMM d, yyyy 'at' p")}`
                            : `Created ${format(row.createdAt, "MMM d, yyyy 'at' p")}`}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Button variant="outline" size="sm" asChild>
                          <Link href={`/admin/clients/${row.assessment.userId}/reports`}>
                            <FileText className="w-4 h-4 mr-2" />
                            Client reports
                          </Link>
                        </Button>
                        <Button variant="outline" size="sm" asChild>
                          <Link href={`/admin/audit-log/entity/Report/${row.id}`}>
                            <History className="w-4 h-4 mr-2" />
                            Audit history
                          </Link>
                        </Button>
                        {row.status !== "DRAFT" ? (
                          <Button variant="outline" size="sm" asChild>
                            <a
                              href={`/api/reports/by-id/${row.id}/pdf`}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <FileDown className="w-4 h-4 mr-2" />
                              Download
                            </a>
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          Page {Math.min(page, totalPages).toLocaleString()} of {totalPages.toLocaleString()}
        </p>
        <div className="flex items-center gap-2">
        {page > 1 ? (
          <Button variant="outline" size="sm" asChild>
            <Link
              href={withParams({
                status,
                q: query,
                from: fromValue,
                to: toValue,
                page: page - 1,
              })}
            >
              ← Previous page
            </Link>
          </Button>
        ) : null}
        {hasNextPage ? (
          <Button variant="outline" size="sm" asChild>
            <Link
              href={withParams({
                status,
                q: query,
                from: fromValue,
                to: toValue,
                page: page + 1,
              })}
            >
              Next page →
            </Link>
          </Button>
        ) : null}
        </div>
      </div>
    </div>
  );
}

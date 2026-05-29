import Link from "next/link";
import type { ReportStatus } from "@prisma/client";
import { FileText, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getPortfolioReportsAction } from "@/lib/actions/advisor-actions";
import { ReportsPortfolio } from "@/components/reports/ReportsPortfolio";
import { ReportsSummaryStrip } from "@/components/reports/ReportsSummaryStrip";
import { redirect } from "next/navigation";

function parseStatusFilter(raw: string | undefined): "ALL" | ReportStatus | undefined {
  if (raw === "DRAFT" || raw === "PUBLISHED" || raw === "SUPERSEDED") return raw;
  return undefined;
}

export default async function AdvisorReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; publish?: string }>;
}) {
  const sp = await searchParams;
  const needsPublishOnly = sp.publish === "needed";
  const statusFilter = parseStatusFilter(sp.status);

  const result = await getPortfolioReportsAction({
    status: statusFilter ?? "ALL",
    needsPublishOnly,
  });

  if (!result.success) {
    redirect("/advisor");
  }

  const data = result.data!;
  const showAll = !statusFilter && !needsPublishOnly;

  return (
    <div className="space-y-8">
      <div className="rounded-xl border border-border/70 bg-card/60 p-4 shadow-sm ring-1 ring-border/30 sm:p-5">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-start gap-3 sm:items-center">
            <div
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-muted/60"
              aria-hidden
            >
              <FileText className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="min-w-0 space-y-1">
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">Reports</h1>
              <p className="text-sm text-muted-foreground max-w-xl">
                Deliverables across your portfolio — drafts, published versions, and PDF downloads
                for each client&apos;s latest assessment.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 sm:justify-end">
            <Button variant="outline" size="sm" asChild className="min-h-9">
              <Link href="/advisor/recommendations" className="inline-flex items-center gap-2">
                <Sparkles className="h-3.5 w-3.5 shrink-0" />
                Recommendations
              </Link>
            </Button>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <FilterLink href="/advisor/reports" active={showAll}>
            All
          </FilterLink>
          <FilterLink href="/advisor/reports?status=DRAFT" active={statusFilter === "DRAFT"}>
            Drafts
          </FilterLink>
          <FilterLink
            href="/advisor/reports?status=PUBLISHED"
            active={statusFilter === "PUBLISHED"}
          >
            Published
          </FilterLink>
          <FilterLink
            href="/advisor/reports?publish=needed"
            active={needsPublishOnly}
          >
            Ready to publish
          </FilterLink>
        </div>
        <div className="mt-4 pt-4 border-t border-border/50">
          <ReportsSummaryStrip summary={data.summary} />
        </div>
      </div>

      <ReportsPortfolio groups={data.groups} />
    </div>
  );
}

function FilterLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Button variant={active ? "default" : "outline"} size="sm" className="h-8" asChild>
      <Link href={href}>{children}</Link>
    </Button>
  );
}

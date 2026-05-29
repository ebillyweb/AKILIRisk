import type { PortfolioReportsSummary } from "@/lib/reports/portfolio-types";

export function ReportsSummaryStrip({ summary }: { summary: PortfolioReportsSummary }) {
  return (
    <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
      <span>
        <span className="font-semibold text-foreground tabular-nums">
          {summary.clientsWithReports}
        </span>{" "}
        {summary.clientsWithReports === 1 ? "client" : "clients"} with reports
      </span>
      <span aria-hidden>·</span>
      <span>
        <span className="font-semibold text-foreground tabular-nums">{summary.totalReports}</span>{" "}
        versions
      </span>
      <span aria-hidden>·</span>
      <span>
        <span className="font-semibold text-foreground tabular-nums">{summary.draftCount}</span>{" "}
        drafts
      </span>
      <span aria-hidden>·</span>
      <span>
        <span className="font-semibold text-emerald-700 dark:text-emerald-300 tabular-nums">
          {summary.publishedCount}
        </span>{" "}
        published
      </span>
      <span aria-hidden>·</span>
      <span>
        <span className="font-semibold text-primary tabular-nums">
          {summary.needsPublishCount}
        </span>{" "}
        ready to publish
      </span>
    </div>
  );
}

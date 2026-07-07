"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { RiskIndicator } from "@/lib/intelligence/types";

interface PortfolioRiskListProps {
  risks: RiskIndicator[];
  /** When set, only risks for this governance subcategory / pillar slug are shown. */
  categoryFilter?: string | null;
  categoryLabel?: string | null;
}

export function PortfolioRiskList({
  risks,
  categoryFilter,
  categoryLabel,
}: PortfolioRiskListProps) {
  const filtered =
    categoryFilter != null && categoryFilter !== ""
      ? risks.filter((r) => r.categorySlug === categoryFilter)
      : risks;

  if (risks.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">
          No significant governance risks identified across your portfolio.
        </p>
      </div>
    );
  }

  if (filtered.length === 0) {
    return (
      <div className="space-y-4">
        {categoryLabel ? (
          <Alert>
            <AlertDescription className="text-sm leading-relaxed">
              No portfolio risks are tagged with <strong>{categoryLabel}</strong> yet. Older assessments
              may roll scores up under a single comprehensive risk domain instead of these six areas — try{" "}
              <Link href="/advisor/intelligence" className="font-medium text-primary underline underline-offset-2">
                clearing the filter
              </Link>{" "}
              to see all indicators.
            </AlertDescription>
          </Alert>
        ) : null}
        <div className="text-center py-8">
          <p className="text-sm text-muted-foreground">Nothing to show for this filter.</p>
        </div>
      </div>
    );
  }

  // Show top 20 risks, but track if there are more
  const displayedRisks = filtered.slice(0, 20);
  const hasMoreRisks = filtered.length > 20;

  return (
    <div className="space-y-4">
      {categoryLabel && categoryFilter ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-sm">
          <span className="text-muted-foreground">
            Filtered by <span className="font-medium text-foreground">{categoryLabel}</span>
          </span>
          <Link
            href="/advisor/intelligence"
            className="shrink-0 font-medium text-primary underline-offset-4 hover:underline"
          >
            Show all
          </Link>
        </div>
      ) : null}
      {/* Risk list */}
      <div className="space-y-3">
        {displayedRisks.map((risk) => (
          <div
            key={`${risk.familyId}-${risk.categorySlug}`}
            className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
          >
            <div className="flex-1 space-y-1">
              <div className="flex items-center gap-3">
                <Link
                  href={`/advisor/intelligence/${risk.familyId}`}
                  className="font-medium hover:underline text-foreground"
                >
                  {risk.familyName}
                </Link>
                <span className="text-sm text-muted-foreground">•</span>
                <span className="text-sm text-muted-foreground">
                  {risk.categoryName}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  Score: {risk.score.toFixed(1)} / 10
                </span>
              </div>
            </div>
            <Badge
              variant={
                risk.severity === 'critical'
                  ? 'warning'
                  : risk.severity === 'moderate'
                  ? 'outline'
                  : 'secondary'
              }
              className={
                risk.severity === 'critical'
                  ? 'bg-red-500/12 text-red-900 dark:text-red-100'
                  : risk.severity === 'moderate'
                  ? 'border-amber-500 text-amber-600 dark:text-amber-400'
                  : ''
              }
            >
              {risk.severity}
            </Badge>
          </div>
        ))}
      </div>

      {/* More risks indicator */}
      {hasMoreRisks && (
        <div className="text-center py-4 border-t">
          <p className="text-sm text-muted-foreground">
            Showing top 20 of {filtered.length} risk indicator{filtered.length === 1 ? "" : "s"}
            {categoryFilter ? " for this risk domain" : ""}
          </p>
        </div>
      )}
    </div>
  );
}
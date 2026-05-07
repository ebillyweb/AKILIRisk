import { Card, CardContent } from "@/components/ui/card";
import type { PlatformKpis } from "@/lib/admin/analytics-queries";

/**
 * §9.1 (BRD) — top-level KPI strip. Six tiles in a row across the top
 * of /admin/analytics. Pure render; data resolved at the page layer.
 */
export function KpiStrip({ kpis }: { kpis: PlatformKpis }) {
  const tiles: Array<{
    label: string;
    value: string;
    sub?: string;
  }> = [
    {
      label: "Active advisors",
      value: kpis.advisorsActive.toString(),
      sub:
        kpis.advisorsSoftDeleted > 0
          ? `${kpis.advisorsSoftDeleted} soft-deleted`
          : undefined,
    },
    {
      label: "Active clients",
      value: kpis.clientsActive.toString(),
      sub:
        kpis.clientsSoftDeleted > 0
          ? `${kpis.clientsSoftDeleted} soft-deleted`
          : undefined,
    },
    {
      label: "Scored assessments",
      value: kpis.scoredAssessments.toString(),
    },
    {
      label: "Published reports",
      value: kpis.publishedReports.toString(),
      sub:
        kpis.draftReports > 0
          ? `${kpis.draftReports} drafts open`
          : undefined,
    },
    {
      label: "Open drafts",
      value: kpis.draftReports.toString(),
    },
    {
      label: "Active subscriptions",
      value: kpis.activeSubscriptions.toString(),
      sub: "Includes grace period",
    },
  ];

  return (
    <Card>
      <CardContent className="grid grid-cols-2 gap-x-6 gap-y-6 pt-6 sm:grid-cols-3 lg:grid-cols-6">
        {tiles.map((t) => (
          <div key={t.label} className="min-w-0">
            <p className="editorial-kicker block">{t.label}</p>
            <p className="mt-2 text-2xl font-semibold tabular-nums leading-tight sm:text-3xl">
              {t.value}
            </p>
            {t.sub ? (
              <p className="mt-1 text-xs text-muted-foreground">{t.sub}</p>
            ) : null}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

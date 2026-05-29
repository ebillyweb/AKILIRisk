import Link from "next/link";
import { FileText, Sparkles, Radio } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getPortfolioRecommendationsAction } from "@/lib/actions/advisor-actions";
import { RecommendationsPortfolio } from "@/components/recommendations/RecommendationsPortfolio";
import { RecommendationsSummaryStrip } from "@/components/recommendations/RecommendationsSummaryStrip";
import { redirect } from "next/navigation";

export default async function AdvisorRecommendationsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; action?: string }>;
}) {
  const sp = await searchParams;
  const actionNeededOnly = sp.action === "needed";
  const statusFilter = sp.status === "all" ? "all" : "pending";

  const result = await getPortfolioRecommendationsAction({
    status: statusFilter,
    actionNeededOnly,
  });

  if (!result.success) {
    redirect("/advisor");
  }

  const data = result.data!;

  return (
    <div className="space-y-8">
      <div className="rounded-xl border border-border/70 bg-card/60 p-4 shadow-sm ring-1 ring-border/30 sm:p-5">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-start gap-3 sm:items-center">
            <div
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-muted/60"
              aria-hidden
            >
              <Sparkles className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="min-w-0 space-y-1">
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                Recommendations
              </h1>
              <p className="text-sm text-muted-foreground max-w-xl">
                Matched remediation services across your portfolio from the latest completed
                assessments. Annotate and publish via each client&apos;s report editor.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 sm:justify-end">
            <Button variant="outline" size="sm" asChild className="min-h-9">
              <Link href="/advisor/reports" className="inline-flex items-center gap-2">
                <FileText className="h-3.5 w-3.5 shrink-0" />
                Reports
              </Link>
            </Button>
            <Button variant="outline" size="sm" asChild className="min-h-9">
              <Link href="/advisor/signals" className="inline-flex items-center gap-2">
                <Radio className="h-3.5 w-3.5 shrink-0" />
                Signals
              </Link>
            </Button>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <FilterLink
            href="/advisor/recommendations"
            active={!actionNeededOnly && statusFilter === "pending"}
          >
            Pending only
          </FilterLink>
          <FilterLink
            href="/advisor/recommendations?status=all"
            active={!actionNeededOnly && statusFilter === "all"}
          >
            All statuses
          </FilterLink>
          <FilterLink
            href="/advisor/recommendations?action=needed"
            active={actionNeededOnly}
          >
            Needs outreach
          </FilterLink>
        </div>
        <div className="mt-4 pt-4 border-t border-border/50">
          <RecommendationsSummaryStrip summary={data.summary} />
        </div>
      </div>

      <RecommendationsPortfolio groups={data.groups} />
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
    <Button
      variant={active ? "default" : "outline"}
      size="sm"
      className="h-8"
      asChild
    >
      <Link href={href}>{children}</Link>
    </Button>
  );
}

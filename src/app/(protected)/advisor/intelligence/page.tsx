import { Suspense } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getPortfolioIntelligenceData } from "@/lib/actions/advisor-actions";
import { getPlatformFeatureFlags } from "@/lib/platform/feature-flags";
import { RISK_AREAS } from "@/lib/advisor/types";
import { RiskSummaryCard } from "@/components/intelligence/RiskSummaryCard";
import { PortfolioRiskList } from "@/components/intelligence/PortfolioRiskList";
import { RiskDistributionChart } from "@/components/intelligence/RiskDistributionChart";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import IntelligenceLoading from "./loading";

const RISK_AREA_IDS = new Set<string>(RISK_AREAS.map((a) => a.id));

function resolveCategoryFilter(raw: string | undefined) {
  if (!raw) return { categoryFilter: undefined as string | undefined, categoryLabel: undefined as string | undefined };
  if (!RISK_AREA_IDS.has(raw)) {
    return { categoryFilter: undefined, categoryLabel: undefined };
  }
  const label = RISK_AREAS.find((a) => a.id === raw)?.name;
  return { categoryFilter: raw, categoryLabel: label };
}

// Async component for data-dependent content
async function IntelligenceContent({
  categoryFilter,
  categoryLabel,
}: {
  categoryFilter?: string;
  categoryLabel?: string;
}) {
  const result = await getPortfolioIntelligenceData();

  if (!result.success) {
    return (
      <div className="space-y-6">
        <div className="text-center py-12">
          <p className="text-destructive text-sm">Error loading portfolio intelligence: {result.error}</p>
        </div>
      </div>
    );
  }

  const data = result.data!;

  // Check if any families have completed assessments
  if (data.totalFamilies === 0 || data.familyRiskSummaries.length === 0) {
    return (
      <div className="space-y-6">
        <div className="text-center py-12">
          <p className="text-muted-foreground">
            No families have completed assessments yet. Risk intelligence will be available after families complete their governance assessments.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Risk summary cards */}
      <RiskSummaryCard
        totalFamilies={data.totalFamilies}
        familiesAtRisk={data.familiesAtRisk}
        criticalCount={data.criticalCount}
        portfolioRisksCount={data.portfolioRisks.length}
      />

      {/* Main content - two column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Portfolio risk list - 2/3 width */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Portfolio Risk Indicators</CardTitle>
            <CardDescription>
              Governance areas requiring attention across your client families, prioritized by severity.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <PortfolioRiskList
              risks={data.portfolioRisks}
              categoryFilter={categoryFilter}
              categoryLabel={categoryLabel}
            />
          </CardContent>
        </Card>

        {/* Risk distribution chart - 1/3 width */}
        <Card>
          <CardHeader>
            <CardTitle>Risk by Category</CardTitle>
          </CardHeader>
          <CardContent>
            <RiskDistributionChart risksByCategory={data.risksByCategory} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default async function IntelligencePage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const flags = await getPlatformFeatureFlags();
  const sp = await searchParams;
  const { categoryFilter, categoryLabel } = resolveCategoryFilter(sp.category);

  const backHref = flags.governanceDashboardEnabled ? "/advisor/dashboard" : "/advisor";
  const backLabel = flags.governanceDashboardEnabled ? "Back to Dashboard" : "Back to Overview";

  return (
    <div className="space-y-6 sm:space-y-8">
      <div>
        <Link
          href={backHref}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          {backLabel}
        </Link>
      </div>

      <Suspense fallback={<IntelligenceLoading />}>
        <IntelligenceContent categoryFilter={categoryFilter} categoryLabel={categoryLabel} />
      </Suspense>
    </div>
  );
}
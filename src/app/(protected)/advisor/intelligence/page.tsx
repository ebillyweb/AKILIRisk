import { Suspense } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import {
  getPortfolioIntelligenceData,
  getPortfolioPillarScoresData,
} from "@/lib/actions/advisor-actions";
import { RISK_AREAS } from "@/lib/advisor/types";
import { isRiskAreaId } from "@/lib/assessment/bank/risk-areas";
import { RiskSummaryCard } from "@/components/intelligence/RiskSummaryCard";
import { PortfolioRiskList } from "@/components/intelligence/PortfolioRiskList";
import { RiskDistributionChart } from "@/components/intelligence/RiskDistributionChart";
import { RiskHeatMap } from "@/components/assessment/RiskHeatMap";
import { AdvisorPillarShortcuts } from "@/components/advisor/intelligence/AdvisorPillarShortcuts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import IntelligenceLoading from "./loading";

function resolveCategoryFilter(raw: string | undefined) {
  if (!raw) return { categoryFilter: undefined as string | undefined, categoryLabel: undefined as string | undefined };
  if (!isRiskAreaId(raw)) {
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
  // Two queries in parallel: aggregate intelligence + per-pillar grid for
  // the round-10 / B1 heat map.
  const [result, heatMapResult] = await Promise.all([
    getPortfolioIntelligenceData(),
    getPortfolioPillarScoresData(),
  ]);

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
  const heatMapRows = heatMapResult.success ? heatMapResult.data : [];

  // Check if any families have completed assessments
  if (data.totalFamilies === 0 || data.familyRiskSummaries.length === 0) {
    return (
      <div className="space-y-6">
        <div className="text-center py-12">
          <p className="text-muted-foreground">
            No families have completed assessments yet. Risk intelligence will be available after families complete their personal risk profiles.
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

      {/* Round-10 / B1 (BRD §4.3): risk heat map by domain across portfolio.
          Sorted DESC by overall risk severity (most-at-risk client first). */}
      <Card>
        <CardHeader>
          <CardTitle>Risk by domain — portfolio</CardTitle>
          <CardDescription>
            BRD §4.3 heat map across your assigned families. Rows sorted by
            overall risk severity (most at risk first).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RiskHeatMap mode="portfolio" rows={heatMapRows} />
        </CardContent>
      </Card>

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
  const sp = await searchParams;
  const { categoryFilter, categoryLabel } = resolveCategoryFilter(sp.category);

  return (
    <div className="space-y-6 sm:space-y-8">
      <div>
        <Link
          href="/advisor"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Advisor workspace
        </Link>
      </div>

      <AdvisorPillarShortcuts />

      <Suspense fallback={<IntelligenceLoading />}>
        <IntelligenceContent categoryFilter={categoryFilter} categoryLabel={categoryLabel} />
      </Suspense>
    </div>
  );
}
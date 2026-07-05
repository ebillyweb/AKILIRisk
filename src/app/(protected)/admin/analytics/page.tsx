import type { UserRole } from "@prisma/client";
import { requireAdminRole } from "@/lib/admin/auth";
import { AUDIT_ACTIONS, writeAudit } from "@/lib/audit/audit-log";
import {
  getPlatformKpis,
  getRiskLevelDistribution,
  getPillarAverages,
  getTopTenantsByClientCount,
  getCommonMissingControls,
} from "@/lib/admin/analytics-queries";
import {
  getOnboardingFunnel,
  getAssessmentActivity,
  getAdvisorClientSnapshot,
  getRiskInsights,
  getUsageTrend,
  getRecentActivity,
} from "@/lib/admin/analytics-metrics";
import { KpiStrip } from "@/components/admin/analytics/KpiStrip";
import { RiskDistributionBar } from "@/components/admin/analytics/RiskDistributionBar";
import { PillarAveragesStrip } from "@/components/admin/analytics/PillarAveragesStrip";
import { TopTenantsTable } from "@/components/admin/analytics/TopTenantsTable";
import { CommonMissingControlsList } from "@/components/admin/analytics/CommonMissingControlsList";
import {
  MetricCard,
  formatCount,
  formatPercent,
  formatHours,
} from "@/components/admin/analytics/MetricCard";
import { FunnelSummary } from "@/components/admin/analytics/FunnelSummary";
import { TrendCard } from "@/components/admin/analytics/TrendCard";
import { RecentActivityPanel } from "@/components/admin/analytics/RecentActivityPanel";

/**
 * §9.1 (BRD) — AKILI-side aggregate analytics dashboard.
 *
 * Admin-only (`requireAdminRole`: `ADMIN` or `SUPER_ADMIN`). Pure aggregate view —
 * no per-client identifiers surface in any card. The PII-invariant
 * test in `analytics-queries.test.ts` enforces this structurally.
 *
 * Five v1 cards (per §9.1 design proposal sign-off):
 *   1. KPI strip (advisors / enterprises / subscriptions / clients / assessments / reports).
 *   2. Risk-level distribution bar.
 *   3. Per risk domain averages strip.
 *   4. Top tenants by client count.
 *   5. Common missing controls (top 10).
 *
 * Data fetching: per-page-load queries (Option A from the proposal),
 * all five run in parallel via `Promise.allSettled` so a slow / failing
 * single query doesn't block the others. Each card degrades to a
 * "Failed to load" placeholder independently.
 *
 * Audit: one `DATA_ACCESS_ANALYTICS_VIEW` row per render, capturing
 * the resolved KPI counts as metadata. Coarse but useful trail of
 * "what did AKILI see on date X" without a snapshot table.
 */
export default async function AdminAnalyticsPage() {
  const session = await requireAdminRole();

  // Per-card error isolation: if any single query throws, fall through
  // with a placeholder for that card. Normal Promise.all would reject
  // the whole render.
  const [
    kpisResult,
    distResult,
    pillarsResult,
    tenantsResult,
    controlsResult,
    funnelResult,
    activityResult,
    snapshotResult,
    riskResult,
    trendResult,
    recentResult,
  ] = await Promise.allSettled([
    getPlatformKpis(),
    getRiskLevelDistribution(),
    getPillarAverages(),
    getTopTenantsByClientCount(),
    getCommonMissingControls(),
    getOnboardingFunnel(),
    getAssessmentActivity(),
    getAdvisorClientSnapshot(),
    getRiskInsights(),
    getUsageTrend(),
    getRecentActivity(),
  ]);

  const kpis = kpisResult.status === "fulfilled" ? kpisResult.value : null;
  const dist = distResult.status === "fulfilled" ? distResult.value : null;
  const pillars =
    pillarsResult.status === "fulfilled" ? pillarsResult.value : null;
  const tenants =
    tenantsResult.status === "fulfilled" ? tenantsResult.value : null;
  const controls =
    controlsResult.status === "fulfilled" ? controlsResult.value : null;
  const funnel =
    funnelResult.status === "fulfilled" ? funnelResult.value : null;
  const activity =
    activityResult.status === "fulfilled" ? activityResult.value : null;
  const snapshot =
    snapshotResult.status === "fulfilled" ? snapshotResult.value : null;
  const risk = riskResult.status === "fulfilled" ? riskResult.value : null;
  const trend = trendResult.status === "fulfilled" ? trendResult.value : null;
  const recent =
    recentResult.status === "fulfilled" ? recentResult.value : [];

  void writeAudit({
    actor: { userId: session.userId, role: session.role as UserRole, email: session.email },
    action: AUDIT_ACTIONS.DATA_ACCESS_ANALYTICS_VIEW,
    entityType: "system",
    entityId: null,
    metadata: kpis
      ? {
          advisorsActive: kpis.advisorsActive,
          clientsActive: kpis.clientsActive,
          scoredAssessments: kpis.scoredAssessments,
          publishedReports: kpis.publishedReports,
          activeSubscriptions: kpis.activeSubscriptions,
        }
      : { error: "kpi_query_failed" },
  });

  return (
    <div className="space-y-6 sm:space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Analytics</h1>
        <p className="mt-2 text-muted-foreground">
          Aggregate view across every advisor and client. No per-client
          identifiers surface here — see <code>/admin/clients</code> for
          per-account drill-down.
        </p>
      </div>

      {kpis ? (
        <KpiStrip kpis={kpis} />
      ) : (
        <CardLoadFailed label="Platform KPIs failed to load." />
      )}

      <div className="grid gap-6">
        {dist ? (
          <RiskDistributionBar distribution={dist} />
        ) : (
          <CardLoadFailed label="Risk-level distribution failed to load." />
        )}
        {pillars ? (
          <PillarAveragesStrip data={pillars} />
        ) : (
          <CardLoadFailed label="Per risk domain averages failed to load." />
        )}
      </div>

      {tenants ? (
        <TopTenantsTable rows={tenants} />
      ) : (
        <CardLoadFailed label="Top-tenants table failed to load." />
      )}

      {controls ? (
        <CommonMissingControlsList rows={controls} />
      ) : (
        <CardLoadFailed label="Common-missing-controls list failed to load." />
      )}

      {/*
        Functional / Business-intelligence sections — additive to the
        §9.1 BRD cards above. Each section degrades to a card-load
        failure independently. Empty datasets are honest about it
        rather than rendering zero-filled charts.
      */}

      <SectionHeader
        title="Business activity"
        subtitle="Volume KPIs across the platform. Real-time counts; no historical aggregation here."
      />
      {activity && snapshot ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            label="Active advisors"
            value={formatCount(snapshot.advisorsActive)}
            sub={`${formatCount(snapshot.advisorsTotal)} total`}
          />
          <MetricCard
            label="Active clients"
            value={formatCount(snapshot.clientsActive)}
            sub={`${formatCount(snapshot.clientsTotal)} total`}
          />
          <MetricCard
            label="Assessments started"
            value={formatCount(activity.total)}
            sub={`${formatCount(activity.inProgress)} in progress`}
          />
          <MetricCard
            label="Assessments completed"
            value={formatCount(activity.completed)}
            sub={
              activity.averageCompletionHours !== null
                ? `Avg ${formatHours(activity.averageCompletionHours)} to complete`
                : "Avg completion time — not enough data yet"
            }
          />
          <MetricCard
            label="Intake submissions"
            value={formatCount(activity.intakeSubmissions)}
            sub="Submitted or completed"
          />
          <MetricCard
            label="Pending assessment requests"
            value={formatCount(activity.pendingRequests)}
            sub="Awaiting advisor assignment"
          />
          <MetricCard
            label="Recommendations generated"
            value={formatCount(activity.recommendationsGenerated)}
            sub={
              risk
                ? `${formatCount(risk.recommendationsAccepted)} accepted · ${formatCount(risk.recommendationsDeclined)} declined`
                : undefined
            }
          />
          <MetricCard
            label="Subscriptions at risk"
            value={formatCount(snapshot.subscriptionsAtRisk)}
            sub={`${formatCount(snapshot.subscriptionsHealthy)} healthy`}
            muted={snapshot.subscriptionsAtRisk === 0}
          />
        </div>
      ) : (
        <CardLoadFailed label="Business-activity KPIs failed to load." />
      )}

      <SectionHeader
        title="Onboarding funnel"
        subtitle="From advisor sign-up to first client intake. Each step is the absolute count and the conversion off the previous step."
      />
      {funnel ? (
        <FunnelSummary funnel={funnel} />
      ) : (
        <CardLoadFailed label="Onboarding funnel failed to load." />
      )}

      <SectionHeader
        title="Risk &amp; recommendation insights"
        subtitle="Where assessments land on risk and how recommendations move through advisor review."
      />
      {risk ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            label="High-risk assessments"
            value={formatCount(risk.highRiskAssessments)}
            sub={
              risk.highRiskShare !== null
                ? `${formatPercent(risk.highRiskShare, 0)} of ${formatCount(risk.scoredAssessments)} scored`
                : "Not enough data yet"
            }
          />
          <MetricCard
            label="Pending recommendations"
            value={formatCount(risk.recommendationsPending)}
            sub="Awaiting advisor review"
          />
          <MetricCard
            label="Recommendations accepted"
            value={formatCount(risk.recommendationsAccepted)}
          />
          <MetricCard
            label="Recommendations declined"
            value={formatCount(risk.recommendationsDeclined)}
            muted={risk.recommendationsDeclined === 0}
          />
        </div>
      ) : (
        <CardLoadFailed label="Risk &amp; recommendation insights failed to load." />
      )}

      <SectionHeader
        title="Usage trend"
        subtitle="Day-by-day flow over the last two weeks. Use this to spot weekly seasonality or sudden drop-offs."
      />
      {trend ? (
        <TrendCard trend={trend} />
      ) : (
        <CardLoadFailed label="Usage trend failed to load." />
      )}

      <SectionHeader
        title="Recent activity"
        subtitle="Latest product events recorded in the audit log."
      />
      <RecentActivityPanel rows={recent} />
    </div>
  );
}

function SectionHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <header className="space-y-1 pt-2">
      <h2 className="text-lg font-semibold tracking-tight text-foreground">
        {title}
      </h2>
      {subtitle ? (
        <p className="max-w-3xl text-sm text-muted-foreground">{subtitle}</p>
      ) : null}
    </header>
  );
}

function CardLoadFailed({ label }: { label: string }) {
  return (
    <div
      role="alert"
      className="rounded-lg border border-dashed border-destructive/50 bg-destructive/5 p-4 text-sm text-destructive"
    >
      {label} Refresh the page or check the server logs.
    </div>
  );
}

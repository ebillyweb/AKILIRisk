import { requireAdminRole } from "@/lib/admin/auth";
import { AUDIT_ACTIONS, writeAudit } from "@/lib/audit/audit-log";
import {
  getPlatformKpis,
  getRiskLevelDistribution,
  getPillarAverages,
  getTopTenantsByClientCount,
  getCommonMissingControls,
} from "@/lib/admin/analytics-queries";
import { KpiStrip } from "@/components/admin/analytics/KpiStrip";
import { RiskDistributionBar } from "@/components/admin/analytics/RiskDistributionBar";
import { PillarAveragesStrip } from "@/components/admin/analytics/PillarAveragesStrip";
import { TopTenantsTable } from "@/components/admin/analytics/TopTenantsTable";
import { CommonMissingControlsList } from "@/components/admin/analytics/CommonMissingControlsList";

/**
 * §9.1 (BRD) — Belvedere-side aggregate analytics dashboard.
 *
 * Admin-only (designated admin email + ADMIN role; see
 * `requireAdminRole` in `src/lib/admin/auth.ts`). Pure aggregate view —
 * no per-client identifiers surface in any card. The PII-invariant
 * test in `analytics-queries.test.ts` enforces this structurally.
 *
 * Five v1 cards (per §9.1 design proposal sign-off):
 *   1. KPI strip (advisors / clients / assessments / reports / subs).
 *   2. Risk-level distribution bar.
 *   3. Per-pillar averages strip.
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
 * "what did Belvedere see on date X" without a snapshot table.
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
  ] = await Promise.allSettled([
    getPlatformKpis(),
    getRiskLevelDistribution(),
    getPillarAverages(),
    getTopTenantsByClientCount(),
    getCommonMissingControls(),
  ]);

  const kpis = kpisResult.status === "fulfilled" ? kpisResult.value : null;
  const dist = distResult.status === "fulfilled" ? distResult.value : null;
  const pillars =
    pillarsResult.status === "fulfilled" ? pillarsResult.value : null;
  const tenants =
    tenantsResult.status === "fulfilled" ? tenantsResult.value : null;
  const controls =
    controlsResult.status === "fulfilled" ? controlsResult.value : null;

  void writeAudit({
    actor: { userId: session.userId, role: session.role as import("@prisma/client").UserRole, email: session.email },
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

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        {dist ? (
          <RiskDistributionBar distribution={dist} />
        ) : (
          <CardLoadFailed label="Risk-level distribution failed to load." />
        )}
        {pillars ? (
          <PillarAveragesStrip data={pillars} />
        ) : (
          <CardLoadFailed label="Per-pillar averages failed to load." />
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
    </div>
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

import type { UserRole } from "@prisma/client";
import { requireSuperAdminRole } from "@/lib/admin/auth";
import { AUDIT_ACTIONS, writeAudit } from "@/lib/audit/audit-log";
import { getPlatformRiskSignals } from "@/lib/admin/risk-signals-queries";
import { PlatformRiskSignalsSummaryStrip } from "@/components/admin/risk-signals/PlatformRiskSignalsSummaryStrip";
import { PillarRiskSignalsTable } from "@/components/admin/risk-signals/PillarRiskSignalsTable";
import { TenantRiskExposureTable } from "@/components/admin/risk-signals/TenantRiskExposureTable";
import { RiskDistributionChart } from "@/components/intelligence/RiskDistributionChart";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminRiskSignalsPage() {
  const session = await requireSuperAdminRole();

  let data: Awaited<ReturnType<typeof getPlatformRiskSignals>> | null = null;
  let loadError: string | null = null;

  try {
    data = await getPlatformRiskSignals();
  } catch {
    loadError = "Risk signals failed to load.";
  }

  if (data) {
    void writeAudit({
      actor: {
        userId: session.userId,
        role: session.role as UserRole,
        email: session.email,
      },
      action: AUDIT_ACTIONS.DATA_ACCESS_RISK_SIGNALS_VIEW,
      entityType: "system",
      entityId: null,
      metadata: {
        familiesWithAssessment: data.summary.familiesWithAssessment,
        familiesAtRisk: data.summary.familiesAtRisk,
        criticalIndicators: data.summary.criticalIndicators,
      },
    });
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Risk signals</h1>
        <p className="mt-2 text-muted-foreground">
          Platform-wide governance risk intelligence using the same score-based
          severity rules as advisor Risk intelligence. Aggregate counts only — no
          per-client identifiers. For volume KPIs and tier distribution, see{" "}
          <a href="/admin/analytics" className="underline underline-offset-2">
            Executive dashboard
          </a>
          .
        </p>
      </div>

      {loadError ? (
        <div
          role="alert"
          className="rounded-xl border border-dashed border-destructive/50 bg-destructive/5 p-6 text-sm text-destructive"
        >
          {loadError}
        </div>
      ) : data ? (
        <>
          <PlatformRiskSignalsSummaryStrip summary={data.summary} />

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg font-semibold">Severity mix</CardTitle>
                <CardDescription>
                  Pillar-level indicators on latest assessments (critical ≤ 3.0,
                  moderate ≤ 5.0).
                </CardDescription>
              </CardHeader>
              <CardContent>
                {data.summary.totalIndicators === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">
                    No indicators yet.
                  </p>
                ) : (
                  <ul className="grid grid-cols-3 gap-3 text-center text-sm">
                    <li className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">
                        Critical
                      </p>
                      <p className="mt-1 text-2xl font-semibold tabular-nums text-destructive">
                        {data.bySeverity.critical}
                      </p>
                    </li>
                    <li className="rounded-lg border border-orange-500/30 bg-orange-500/5 p-3">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">
                        Moderate
                      </p>
                      <p className="mt-1 text-2xl font-semibold tabular-nums">
                        {data.bySeverity.moderate}
                      </p>
                    </li>
                    <li className="rounded-lg border p-3">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">
                        Low
                      </p>
                      <p className="mt-1 text-2xl font-semibold tabular-nums">
                        {data.bySeverity.low}
                      </p>
                    </li>
                  </ul>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg font-semibold">
                  Families at risk by domain
                </CardTitle>
                <CardDescription>
                  Count of families with critical or moderate scores in each pillar.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <RiskDistributionChart risksByCategory={data.risksByCategory} />
              </CardContent>
            </Card>
          </div>

          <PillarRiskSignalsTable pillars={data.pillars} />
          <TenantRiskExposureTable rows={data.topTenantsByRisk} />
        </>
      ) : null}
    </div>
  );
}

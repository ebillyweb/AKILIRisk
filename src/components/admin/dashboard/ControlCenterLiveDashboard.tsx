"use client";

import {
  Activity,
  AlertTriangle,
  CheckCircle,
  ClipboardList,
  Clock,
  Eye,
  FileText,
  LogIn,
  Puzzle,
  Server,
  UserPlus,
  Users,
  Zap,
} from "lucide-react";
import type { ControlCenterAlertIconKey } from "@/lib/admin/control-center-alerts";
import type { ControlCenterActivityIconKey } from "@/lib/admin/control-center-activity";
import type { ControlCenterSnapshot } from "@/lib/admin/control-center-types";
import { MetricCard } from "@/components/admin/dashboard/MetricCard";
import { NeedsAttentionItem } from "@/components/admin/dashboard/NeedsAttentionItem";
import { RecentActivityItem } from "@/components/admin/dashboard/RecentActivityItem";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ControlCenterLiveStatus } from "./ControlCenterLiveStatus";
import { useControlCenterPolling } from "./use-control-center-polling";
import { ErrorBoundary } from "./ErrorBoundary";

const ALERT_ICONS: Record<ControlCenterAlertIconKey, typeof Clock> = {
  clock: Clock,
  puzzle: Puzzle,
  userPlus: UserPlus,
  clipboardList: ClipboardList,
  alertTriangle: AlertTriangle,
};

const ACTIVITY_ICONS: Record<ControlCenterActivityIconKey, typeof CheckCircle> = {
  checkCircle: CheckCircle,
  userPlus: UserPlus,
  clipboardList: ClipboardList,
  alertTriangle: AlertTriangle,
  fileText: FileText,
  activity: Activity,
};

interface ControlCenterLiveDashboardProps {
  initialSnapshot: ControlCenterSnapshot;
}

export function ControlCenterLiveDashboard({
  initialSnapshot,
}: ControlCenterLiveDashboardProps) {
  const { snapshot, status, lastError, refresh, pollMs } =
    useControlCenterPolling(initialSnapshot);

  const { metrics, alerts, activity } = snapshot;

  return (
    <>
      <ControlCenterLiveStatus
        generatedAt={snapshot.generatedAt}
        status={status}
        lastError={lastError}
        pollMs={pollMs}
        onRefresh={refresh}
      />

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-foreground">Platform Status</h2>
        <ErrorBoundary
          fallback={
            <div className="text-sm text-muted-foreground p-4 border border-border rounded-lg bg-muted/30">
              Unable to load platform metrics at this time. Please try refreshing the page.
            </div>
          }
          resetKeys={[snapshot.generatedAt]}
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-7">
            <MetricCard
              title="Active Advisors"
              value={metrics?.activeAdvisors?.value ?? "—"}
              icon={Users}
              trend={metrics?.activeAdvisors?.trend}
              status="healthy"
            />
            <MetricCard
              title="Daily Logins"
              value={metrics?.dailyLogins?.value ?? "—"}
              icon={LogIn}
              trend={metrics?.dailyLogins?.trend}
              status="neutral"
              subtitle="Unique users today (UTC)"
            />
            <MetricCard
              title="Assessments in Progress"
              value={metrics?.assessmentsInProgress?.value ?? "—"}
              icon={ClipboardList}
              trend={metrics?.assessmentsInProgress?.trend}
              status="neutral"
            />
            <MetricCard
              title="Intake Completion"
              value={metrics?.intakeCompletionRate?.value ?? "—"}
              icon={CheckCircle}
              trend={metrics?.intakeCompletionRate?.trend}
              status="healthy"
            />
            <MetricCard
              title="Platform Status"
              value={metrics?.platformStatus?.value ?? "—"}
              icon={Server}
              status={metrics?.platformStatus?.status ?? "neutral"}
            />
            <MetricCard
              title="Failed Integrations"
              value={metrics?.failedIntegrations?.value ?? "—"}
              icon={Puzzle}
              status={metrics?.failedIntegrations?.status ?? "neutral"}
              subtitle={
                metrics?.failedIntegrations?.value && metrics.failedIntegrations.value > 0
                  ? "Requires attention"
                  : undefined
              }
            />
            <MetricCard
              title="Pending Reviews"
              value={metrics?.pendingReviews?.value ?? "—"}
              icon={Eye}
              trend={metrics?.pendingReviews?.trend}
              status="neutral"
            />
          </div>
        </ErrorBoundary>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-foreground">Needs Attention</h2>
        <ErrorBoundary
          fallback={
            <div className="text-sm text-muted-foreground p-4 border border-border rounded-lg bg-muted/30">
              Unable to load alerts at this time. Please try refreshing the page.
            </div>
          }
          resetKeys={[snapshot.generatedAt]}
        >
          <div className="space-y-3">
            {alerts === null ? (
              <p className="text-sm text-muted-foreground">
                Unable to load alerts right now.
              </p>
            ) : alerts.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No items need attention — platform operations look clear.
              </p>
            ) : (
              alerts.map((alert) => (
                <NeedsAttentionItem
                  key={alert.id}
                  title={alert.title}
                  description={alert.description}
                  severity={alert.severity}
                  icon={ALERT_ICONS[alert.iconKey]}
                  href={alert.href}
                  timestamp={alert.timestamp}
                />
              ))
            )}
          </div>
        </ErrorBoundary>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-foreground">Recent Activity</h2>
        <ErrorBoundary
          fallback={
            <Card>
              <CardContent className="p-6">
                <div className="text-sm text-muted-foreground text-center">
                  Unable to load recent activity at this time. Please try refreshing the page.
                </div>
              </CardContent>
            </Card>
          }
          resetKeys={[snapshot.generatedAt]}
        >
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base font-medium">
                <Zap className="size-4" />
                Platform Events
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {activity === null ? (
                <p className="text-sm text-muted-foreground">
                  Unable to load recent activity right now.
                </p>
              ) : activity.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No platform events recorded yet.
                </p>
              ) : (
                activity.map((item, index) => (
                  <div key={item.id}>
                    <RecentActivityItem
                      type={item.type}
                      icon={ACTIVITY_ICONS[item.iconKey]}
                      title={item.title}
                      description={item.description}
                      timestamp={item.timestamp}
                      user={item.user}
                    />
                    {index < activity.length - 1 && (
                      <Separator className="mt-4" />
                    )}
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </ErrorBoundary>
      </section>
    </>
  );
}

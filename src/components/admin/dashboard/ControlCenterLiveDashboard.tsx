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
import { MetricCard, MetricCardSkeleton } from "@/components/admin/dashboard/MetricCard";
import { NeedsAttentionItem } from "@/components/admin/dashboard/NeedsAttentionItem";
import { RecentActivityItem } from "@/components/admin/dashboard/RecentActivityItem";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
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
      <section className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <h2 className="text-lg font-semibold text-foreground">At a glance</h2>
          <ControlCenterLiveStatus
            generatedAt={snapshot.generatedAt}
            status={status}
            lastError={lastError}
            pollMs={pollMs}
            onRefresh={refresh}
          />
        </div>
        <ErrorBoundary
          fallback={
            <div className="text-sm text-muted-foreground p-4 border border-border rounded-lg bg-muted/30">
              Unable to load platform metrics at this time. Please try refreshing the page.
            </div>
          }
          resetKeys={[snapshot.generatedAt]}
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {metrics === null && status !== "error" ? (
              Array.from({ length: 7 }).map((_, i) => (
                <MetricCardSkeleton key={i} />
              ))
            ) : (
              <>
            <MetricCard
              title="Active advisors"
              value={metrics?.activeAdvisors?.value ?? "—"}
              icon={Users}
              trend={metrics?.activeAdvisors?.trend}
              trendLabel="new in last 30 days"
            />
            <MetricCard
              title="Daily logins"
              value={metrics?.dailyLogins?.value ?? "—"}
              icon={LogIn}
              trend={metrics?.dailyLogins?.trend}
              trendLabel="vs yesterday"
              subtitle="Unique users · US Central day"
            />
            <MetricCard
              title="Assessments in progress"
              value={metrics?.assessmentsInProgress?.value ?? "—"}
              icon={ClipboardList}
              trend={metrics?.assessmentsInProgress?.trend}
              trendLabel="started in last 30 days"
            />
            <MetricCard
              title="Intake completion"
              value={metrics?.intakeCompletionRate?.value ?? "—"}
              icon={CheckCircle}
              trend={metrics?.intakeCompletionRate?.trend}
              trendLabel="vs prior 30 days"
            />
            <MetricCard
              title="System health"
              value={metrics?.platformStatus?.value ?? "—"}
              icon={Server}
              status={metrics?.platformStatus?.status ?? "neutral"}
            />
            <MetricCard
              title="Failed integrations"
              value={metrics?.failedIntegrations?.value ?? "—"}
              icon={Puzzle}
              status={metrics?.failedIntegrations?.status ?? "neutral"}
              subtitle={
                metrics?.failedIntegrations?.value && metrics.failedIntegrations.value > 0
                  ? "Requires attention"
                  : "All integrations healthy"
              }
            />
            <MetricCard
              title="Pending reviews"
              value={metrics?.pendingReviews?.value ?? "—"}
              icon={Eye}
              trend={metrics?.pendingReviews?.trend}
              trendLabel="vs reviews open 30+ days"
            />
              </>
            )}
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
              status === "error" ? (
                <p className="text-sm text-muted-foreground">
                  Unable to load alerts right now.
                </p>
              ) : (
                Array.from({ length: 3 }).map((_, i) => (
                  <NeedsAttentionItemSkeleton key={i} />
                ))
              )
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
                status === "error" ? (
                  <p className="text-sm text-muted-foreground">
                    Unable to load recent activity right now.
                  </p>
                ) : (
                  Array.from({ length: 4 }).map((_, i) => (
                    <div key={i}>
                      <RecentActivityItemSkeleton />
                      {i < 3 && <Separator className="mt-4" />}
                    </div>
                  ))
                )
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

/** Loading placeholder mirroring {@link NeedsAttentionItem}'s row layout. */
function NeedsAttentionItemSkeleton() {
  return (
    <div
      aria-hidden
      className="flex items-start gap-4 rounded-lg border bg-card p-4"
    >
      <Skeleton className="size-8 shrink-0 rounded-lg" />
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-4 w-14 rounded-full" />
        </div>
        <Skeleton className="h-3 w-64 max-w-full" />
        <Skeleton className="h-3 w-24" />
      </div>
    </div>
  );
}

/** Loading placeholder mirroring {@link RecentActivityItem}'s row layout. */
function RecentActivityItemSkeleton() {
  return (
    <div aria-hidden className="flex items-start gap-3">
      <Skeleton className="mt-0.5 size-7 shrink-0 rounded-lg" />
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <Skeleton className="h-4 w-48 max-w-full" />
          <Skeleton className="h-3 w-16 shrink-0" />
        </div>
        <Skeleton className="h-3 w-56 max-w-full" />
        <Skeleton className="h-3 w-20" />
      </div>
    </div>
  );
}

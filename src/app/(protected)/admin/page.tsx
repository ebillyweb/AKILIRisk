import {
  Activity,
  AlertTriangle,
  BarChart3,
  CheckCircle,
  ClipboardList,
  Clock,
  FileText,
  Gauge,
  Puzzle,
  Server,
  Settings,
  Shield,
  TrendingUp,
  UserPlus,
  Users,
  UserRound,
  Zap,
  BookOpen,
  Eye,
} from "lucide-react";
import { auth } from "@/lib/auth";
import { isSuperAdmin, requireAdminRole } from "@/lib/admin/auth";
import { MetricCard } from "@/components/admin/dashboard/MetricCard";
import { NeedsAttentionItem } from "@/components/admin/dashboard/NeedsAttentionItem";
import { WorkspaceCard } from "@/components/admin/dashboard/WorkspaceCard";
import { RecentActivityItem } from "@/components/admin/dashboard/RecentActivityItem";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { getControlCenterMetrics } from "@/lib/admin/control-center-metrics";
import {
  getControlCenterAlerts,
  type ControlCenterAlertIconKey,
} from "@/lib/admin/control-center-alerts";

const ALERT_ICONS: Record<
  ControlCenterAlertIconKey,
  typeof Clock
> = {
  clock: Clock,
  puzzle: Puzzle,
  userPlus: UserPlus,
  clipboardList: ClipboardList,
  alertTriangle: AlertTriangle,
};

const PLACEHOLDER_ACTIVITY = [
  {
    type: "assessment" as const,
    icon: CheckCircle,
    title: "Assessment Completed",
    description: "Family risk assessment for Anderson household finalized",
    timestamp: "5 min ago",
    user: "advisor@test.com",
  },
  {
    type: "advisor" as const,
    icon: UserPlus,
    title: "New Advisor Onboarded",
    description: "Sarah Chen completed platform setup and compliance verification",
    timestamp: "23 min ago",
    user: "admin@akili.com",
  },
  {
    type: "intake" as const,
    icon: ClipboardList,
    title: "Intake Submitted",
    description: "Client completed comprehensive household intake interview",
    timestamp: "1 hour ago",
    user: "client@test.com",
  },
  {
    type: "integration" as const,
    icon: AlertTriangle,
    title: "Integration Alert Resolved",
    description: "Risk data provider API connection restored after 15-minute outage",
    timestamp: "2 hours ago",
    user: "system",
  },
  {
    type: "report" as const,
    icon: FileText,
    title: "Risk Report Generated",
    description: "Quarterly portfolio risk summary for Enterprise Client Group",
    timestamp: "3 hours ago",
    user: "scheduler",
  },
];

export default async function AdminControlCenterPage() {
  await requireAdminRole();
  const session = await auth();
  const superUser = isSuperAdmin(session);

  const [metricsResult, alertsResult] = await Promise.allSettled([
    getControlCenterMetrics(),
    getControlCenterAlerts(),
  ]);
  const metrics =
    metricsResult.status === "fulfilled" ? metricsResult.value : null;
  const alerts =
    alertsResult.status === "fulfilled" ? alertsResult.value : null;

  return (
    <div className="space-y-8">
      {/* Header */}
      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          AKILI Control Center
        </h1>
        <p className="text-lg text-muted-foreground">
          Platform health, advisor activity, assessments, and operational oversight.
        </p>
      </header>

      {/* Status Metrics */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-foreground">Platform Status</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          <MetricCard
            title="Active Advisors"
            value={metrics?.activeAdvisors.value ?? "—"}
            icon={Users}
            trend={metrics?.activeAdvisors.trend}
            status="healthy"
          />
          <MetricCard
            title="Assessments in Progress"
            value={metrics?.assessmentsInProgress.value ?? "—"}
            icon={ClipboardList}
            trend={metrics?.assessmentsInProgress.trend}
            status="neutral"
          />
          <MetricCard
            title="Intake Completion"
            value={metrics?.intakeCompletionRate.value ?? "—"}
            icon={CheckCircle}
            trend={metrics?.intakeCompletionRate.trend}
            status="healthy"
          />
          <MetricCard
            title="Platform Status"
            value={metrics?.platformStatus.value ?? "—"}
            icon={Server}
            status={metrics?.platformStatus.status ?? "neutral"}
          />
          <MetricCard
            title="Failed Integrations"
            value={metrics?.failedIntegrations.value ?? "—"}
            icon={Puzzle}
            status={metrics?.failedIntegrations.status ?? "neutral"}
            subtitle={
              metrics && metrics.failedIntegrations.value > 0
                ? "Requires attention"
                : undefined
            }
          />
          <MetricCard
            title="Pending Reviews"
            value={metrics?.pendingReviews.value ?? "—"}
            icon={Eye}
            trend={metrics?.pendingReviews.trend}
            status="neutral"
          />
        </div>
      </section>

      {/* Needs Attention */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-foreground">Needs Attention</h2>
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
      </section>

      {/* Workspace Shortcuts */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-foreground">Quick Access</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Assessment Operations */}
          <div className="space-y-4">
            <h3 className="text-base font-medium text-muted-foreground">Assessment Operations</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <WorkspaceCard
                href="/admin/leads"
                title="New Requests"
                description="Public lead form submissions awaiting assignment"
                icon={ClipboardList}
                badge={{ text: "12", variant: "default" }}
              />
              <WorkspaceCard
                href="/admin/assessment"
                title="Active Reviews"
                description="In-progress assessments requiring attention"
                icon={Eye}
                badge={{ text: "47", variant: "secondary" }}
              />
              <WorkspaceCard
                href="/admin/intake"
                title="Intake Queue"
                description="Interview submissions pending review"
                icon={ClipboardList}
                badge={{ text: "8", variant: "default" }}
              />
              <WorkspaceCard
                href="/admin/recommendations"
                title="Recommendation Rules"
                description="Service catalog and matching engine"
                icon={BookOpen}
              />
            </div>
          </div>

          {/* People Management */}
          <div className="space-y-4">
            <h3 className="text-base font-medium text-muted-foreground">People Management</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <WorkspaceCard
                href="/admin/advisors"
                title="Advisors"
                description="Account management and onboarding status"
                icon={Users}
                badge={{ text: "23", variant: "secondary" }}
              />
              <WorkspaceCard
                href="/admin/clients"
                title="Clients"
                description="Client accounts and advisor assignments"
                icon={UserRound}
                badge={{ text: "156", variant: "secondary" }}
              />
              {superUser && (
                <WorkspaceCard
                  href="/admin/staff"
                  title="Staff Access"
                  description="Admin and super-admin role management"
                  icon={Shield}
                  badge={{ text: "Super Admin", variant: "outline" }}
                />
              )}
            </div>
          </div>

          {/* Platform Operations */}
          <div className="space-y-4">
            <h3 className="text-base font-medium text-muted-foreground">Platform Operations</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {superUser && (
                <WorkspaceCard
                  href="/admin/operations"
                  title="API Health"
                  description="Service status and dependency monitoring"
                  icon={Gauge}
                  badge={{ text: "Operational", variant: "default" }}
                />
              )}
              <WorkspaceCard
                href="/admin/audit-log"
                title="Audit Logs"
                description="Compliance trail and security events"
                icon={Activity}
              />
              {superUser && (
                <WorkspaceCard
                  href="/admin/integrations"
                  title="Integrations"
                  description="External service connections and status"
                  icon={Puzzle}
                  badge={{ text: "2 Issues", variant: "outline" }}
                />
              )}
              <WorkspaceCard
                href="/admin/settings"
                title="Configuration"
                description="Platform settings and feature flags"
                icon={Settings}
              />
            </div>
          </div>

          {/* Analytics & Intelligence */}
          <div className="space-y-4">
            <h3 className="text-base font-medium text-muted-foreground">Analytics & Intelligence</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <WorkspaceCard
                href="/admin/analytics"
                title="Business Analytics"
                description="Onboarding funnel and platform metrics"
                icon={BarChart3}
              />
              {superUser && (
                <WorkspaceCard
                  href="/admin/risk-signals"
                  title="Risk Signals"
                  description="Platform-wide risk intelligence monitoring"
                  icon={AlertTriangle}
                />
              )}
              <WorkspaceCard
                href="/admin/reports"
                title="Reports"
                description="Executive dashboards and data exports"
                icon={FileText}
              />
              <WorkspaceCard
                href="/admin/analytics"
                title="Advisor Financial Health"
                description="Portfolio performance and advisor metrics"
                icon={TrendingUp}
              />
            </div>
          </div>
        </div>
      </section>

      {/* Recent Activity */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-foreground">Recent Activity</h2>
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <Zap className="size-4" />
              Platform Events
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {PLACEHOLDER_ACTIVITY.map((activity, index) => (
              <div key={index}>
                <RecentActivityItem
                  type={activity.type}
                  icon={activity.icon}
                  title={activity.title}
                  description={activity.description}
                  timestamp={activity.timestamp}
                  user={activity.user}
                />
                {index < PLACEHOLDER_ACTIVITY.length - 1 && (
                  <Separator className="mt-4" />
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
import {
  BarChart3,
  BookOpen,
  ClipboardList,
  Eye,
  FileText,
  Gauge,
  ListChecks,
  Mic,
  Puzzle,
  Settings,
  Shield,
  TrendingUp,
  UserRound,
  Users,
} from "lucide-react";
import { requireAdminRole } from "@/lib/admin/auth";
import { getCachedControlCenterSnapshot } from "@/lib/admin/control-center-snapshot-cached";
import { ControlCenterLiveDashboard } from "@/components/admin/dashboard/ControlCenterLiveDashboard";
import { WorkspaceCard } from "@/components/admin/dashboard/WorkspaceCard";

export default async function AdminControlCenterPage() {
  const adminContext = await requireAdminRole();
  const superUser = adminContext.role === "SUPER_ADMIN";
  const initialSnapshot = await getCachedControlCenterSnapshot();

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          AKILI Control Center
        </h1>
        <p className="text-lg text-muted-foreground">
          Platform health, advisor activity, assessments, and operational oversight.
        </p>
      </header>

      <ControlCenterLiveDashboard initialSnapshot={initialSnapshot} />

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-foreground">Quick Access</h2>
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          <div className="space-y-4">
            <h3 className="text-base font-medium text-muted-foreground">
              Assessment operations
            </h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              <WorkspaceCard
                href="/admin/leads"
                title="Assessment requests"
                description="Public lead form submissions awaiting assignment"
                icon={ClipboardList}
                badge={{ text: "12", variant: "default" }}
              />
              <WorkspaceCard
                href="/admin/assessment"
                title="Active assessments"
                description="In-progress assessments requiring attention"
                icon={Eye}
                badge={{ text: "47", variant: "secondary" }}
              />
              <WorkspaceCard
                href="/admin/intake"
                title="Intake queue"
                description="Interview submissions pending review"
                icon={ClipboardList}
                badge={{ text: "8", variant: "default" }}
              />
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-base font-medium text-muted-foreground">Configuration</h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              <WorkspaceCard
                href="/admin/intake/questions"
                title="Intake question bank"
                description="Audio intake script — copy, order, and visibility"
                icon={Mic}
              />
              <WorkspaceCard
                href="/admin/assessment/questions"
                title="Assessment question bank"
                description="Governance questions by risk area"
                icon={ListChecks}
              />
              <WorkspaceCard
                href="/admin/recommendations"
                title="Recommendations"
                description="Service catalog and matching rules"
                icon={BookOpen}
              />
              {superUser && (
                <WorkspaceCard
                  href="/admin/scoring/thresholds"
                  title="Risk-tier thresholds"
                  description="Low, medium, and high resilience cutoffs"
                  icon={Shield}
                  badge={{ text: "Super Admin", variant: "outline" }}
                />
              )}
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-base font-medium text-muted-foreground">
              People management
            </h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
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
                  title="Staff access"
                  description="Admin and super-admin role management"
                  icon={Shield}
                  badge={{ text: "Super Admin", variant: "outline" }}
                />
              )}
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-base font-medium text-muted-foreground">
              Platform operations
            </h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              <WorkspaceCard
                href="/admin/operations"
                title="Operations health"
                description="Service status and dependency monitoring"
                icon={Gauge}
                badge={{ text: "Operational", variant: "default" }}
              />
              <WorkspaceCard
                href="/admin/audit-log"
                title="Audit logs"
                description="Compliance trail and security events"
                icon={FileText}
              />
              {superUser && (
                <WorkspaceCard
                  href="/admin/integrations"
                  title="Integrations"
                  description="External service connections and status"
                  icon={Puzzle}
                  badge={integrationsQuickAccessBadge(
                    initialSnapshot.metrics?.failedIntegrations.value ?? 0
                  )}
                />
              )}
              <WorkspaceCard
                href="/admin/settings"
                title="Settings"
                description="Platform settings and advisor feature flags"
                icon={Settings}
              />
            </div>
          </div>

          <div className="space-y-4 lg:col-span-2">
            <h3 className="text-base font-medium text-muted-foreground">
              Analytics & intelligence
            </h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <WorkspaceCard
                href="/admin/analytics"
                title="Executive dashboard"
                description="Onboarding funnel and platform metrics"
                icon={BarChart3}
              />
              {superUser && (
                <WorkspaceCard
                  href="/admin/risk-signals"
                  title="Risk signals"
                  description="Platform-wide risk intelligence monitoring"
                  icon={TrendingUp}
                />
              )}
              <WorkspaceCard
                href="/admin/reports"
                title="Reports"
                description="Published reports and executive exports"
                icon={FileText}
              />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function integrationsQuickAccessBadge(failedCount: number): {
  text: string;
  variant: "default" | "secondary" | "outline";
} {
  if (failedCount <= 0) {
    return { text: "Healthy", variant: "default" };
  }
  const label = failedCount === 1 ? "1 Issue" : `${failedCount} Issues`;
  return { text: label, variant: "outline" };
}

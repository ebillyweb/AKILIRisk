import {
  BarChart3,
  BookOpen,
  ClipboardList,
  Eye,
  FileText,
  Gauge,
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
              Assessment Operations
            </h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
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

          <div className="space-y-4">
            <h3 className="text-base font-medium text-muted-foreground">
              People Management
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
                  title="Staff Access"
                  description="Admin and super-admin role management"
                  icon={Shield}
                  badge={{ text: "Super Admin", variant: "outline" }}
                />
              )}
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-base font-medium text-muted-foreground">
              Platform Operations
            </h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
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
                icon={FileText}
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

          <div className="space-y-4">
            <h3 className="text-base font-medium text-muted-foreground">
              Analytics & Intelligence
            </h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
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
                  icon={TrendingUp}
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
    </div>
  );
}

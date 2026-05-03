import Link from "next/link";
import { UserPlus, Send, Settings, GitBranch, ArrowRight } from "lucide-react";
import { getAdvisorDashboardData } from "@/lib/actions/advisor-actions";
import { getClientPipelineData } from "@/lib/actions/pipeline-actions";
import { ADVISOR_PILLAR_SHORTCUTS } from "@/lib/advisor/pillar-shortcuts";
import { NotificationBell } from "@/components/advisor/NotificationBell";
import { Button } from "@/components/ui/button";
import { UnauthorizedNotice } from "@/components/layout/UnauthorizedNotice";

export default async function AdvisorHomePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const [sp, dash, pipelineRes] = await Promise.all([
    searchParams,
    getAdvisorDashboardData(),
    getClientPipelineData(),
  ]);

  if (!dash.success) {
    return (
      <div className="space-y-6">
        <div className="text-center py-12">
          <p className="text-destructive text-sm">
            Error loading advisor home: {dash.error}
          </p>
        </div>
      </div>
    );
  }

  const { profile, unreadNotificationCount, pendingInvitationsCount } = dash.data!;

  const pipelineOk = pipelineRes.success;
  const metrics = pipelineOk ? pipelineRes.data!.metrics : null;

  const byStage = metrics?.byStage;
  const activeInFlight =
    (byStage?.INTAKE_IN_PROGRESS ?? 0) + (byStage?.ASSESSMENT_IN_PROGRESS ?? 0);
  const totalAssigned = metrics?.total ?? 0;

  return (
    <div className="space-y-8">
      <UnauthorizedNotice error={sp.error} />
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <h2 className="text-lg font-semibold tracking-tight">Overview</h2>
          <p className="text-sm text-muted-foreground">
            Welcome back
            {profile.user.firstName ? `, ${profile.user.firstName}` : ""}
            {profile.firmName ? ` · ${profile.firmName}` : ""}. Use{" "}
            <span className="font-medium text-foreground">Pipeline</span> for the full client list,
            stages, and filters.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button asChild variant="default">
            <Link href="/advisor/pipeline" className="inline-flex items-center gap-2">
              <GitBranch className="h-4 w-4" />
              Open pipeline
              <ArrowRight className="h-4 w-4 opacity-80" />
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/advisor/invitations" className="inline-flex items-center gap-2">
              <UserPlus className="h-4 w-4" />
              Invite client
            </Link>
          </Button>
          <NotificationBell initialCount={unreadNotificationCount} />
        </div>
      </div>

      {!pipelineOk && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-100">
          Could not load pipeline metrics.{" "}
          <Link href="/advisor/pipeline" className="font-medium underline underline-offset-2">
            Try the pipeline page
          </Link>
          {pipelineRes.success === false && ` (${pipelineRes.error})`}
        </div>
      )}

      {pipelineOk && metrics && (
        <div className="rounded-lg border bg-card p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-medium text-muted-foreground">Pipeline at a glance</h2>
            <Link
              href="/advisor/pipeline"
              className="text-xs font-medium text-primary hover:underline"
            >
              View full pipeline
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <div className="rounded-md bg-muted/50 px-3 py-2 text-center">
              <p className="text-lg font-semibold">{totalAssigned}</p>
              <p className="text-xs text-muted-foreground">Assigned clients</p>
            </div>
            <div className="rounded-md bg-muted/50 px-3 py-2 text-center">
              <p className="text-lg font-semibold">{pendingInvitationsCount}</p>
              <p className="text-xs text-muted-foreground">Pending invitations</p>
            </div>
            <div className="rounded-md bg-muted/50 px-3 py-2 text-center">
              <p className="text-lg font-semibold">{byStage!.INTAKE_COMPLETE}</p>
              <p className="text-xs text-muted-foreground">Awaiting your review</p>
            </div>
            <div className="rounded-md bg-muted/50 px-3 py-2 text-center">
              <p className="text-lg font-semibold">{activeInFlight}</p>
              <p className="text-xs text-muted-foreground">Intake / assessment active</p>
            </div>
            <div className="rounded-md bg-muted/50 px-3 py-2 text-center">
              <p className="text-lg font-semibold">{metrics.documentsNeeded}</p>
              <p className="text-xs text-muted-foreground">Need documents</p>
            </div>
            <div className="rounded-md bg-muted/50 px-3 py-2 text-center">
              <p className="text-lg font-semibold">{metrics.stalled}</p>
              <p className="text-xs text-muted-foreground">Stalled (7+ days)</p>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-10">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold tracking-tight">Shortcuts</h2>
          <p className="text-sm text-muted-foreground">
            Open the structured question bank by risk area, or use workspace tools below.
          </p>
        </div>

        <section
          aria-labelledby="advisor-shortcuts-pillars-heading"
          className="rounded-xl border border-border/80 bg-gradient-to-b from-primary/[0.04] to-transparent p-5 shadow-sm sm:p-6"
        >
          <div className="mb-4 space-y-1">
            <h3
              id="advisor-shortcuts-pillars-heading"
              className="text-base font-semibold text-foreground"
            >
              Assessment pillars
            </h3>
            <p className="text-sm text-muted-foreground">
              The six focus areas used across intake and governance scoring.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {ADVISOR_PILLAR_SHORTCUTS.map(({ id, name, summary, icon: PillarIcon }) => {
              const href = `/advisor/question-bank/${encodeURIComponent(id)}`;
              return (
                <Link key={id} href={href} className="group">
                  <div className="h-full rounded-lg border border-border/70 bg-card p-5 transition-colors hover:border-primary/25 hover:bg-muted/40">
                    <div className="flex items-start gap-4">
                      <div className="rounded-md bg-primary/10 p-2 ring-1 ring-primary/10">
                        <PillarIcon className="h-5 w-5 text-primary" aria-hidden />
                      </div>
                      <div className="min-w-0 space-y-1">
                        <h4 className="font-semibold leading-snug group-hover:text-primary">{name}</h4>
                        <p className="text-sm text-muted-foreground leading-relaxed">{summary}</p>
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>

        <section
          aria-labelledby="advisor-shortcuts-workspace-heading"
          className="rounded-xl border bg-card p-5 shadow-sm sm:p-6"
        >
          <div className="mb-4 space-y-1">
            <h3 id="advisor-shortcuts-workspace-heading" className="text-base font-semibold">
              Workspace
            </h3>
            <p className="text-sm text-muted-foreground">
              Pipeline, invitations, and how your practice appears in the product.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Link href="/advisor/pipeline" className="group">
              <div className="h-full rounded-lg border bg-background p-5 transition-colors hover:bg-muted/50">
                <div className="flex items-start gap-4">
                  <div className="rounded-md bg-muted p-2">
                    <GitBranch className="h-5 w-5 text-foreground" aria-hidden />
                  </div>
                  <div className="space-y-1">
                    <h4 className="font-semibold group-hover:text-primary">Pipeline</h4>
                    <p className="text-sm text-muted-foreground">
                      Stages, filters, and client drill-down with live updates
                    </p>
                  </div>
                </div>
              </div>
            </Link>

            <Link href="/advisor/invitations" className="group">
              <div className="h-full rounded-lg border bg-background p-5 transition-colors hover:bg-muted/50">
                <div className="flex items-start gap-4">
                  <div className="rounded-md bg-muted p-2">
                    <Send className="h-5 w-5 text-foreground" aria-hidden />
                  </div>
                  <div className="space-y-1">
                    <h4 className="font-semibold group-hover:text-primary">Invitations</h4>
                    <p className="text-sm text-muted-foreground">Send and manage invitations</p>
                    {pendingInvitationsCount > 0 && (
                      <p className="text-xs text-amber-600 dark:text-amber-500">
                        {pendingInvitationsCount} pending invitation
                        {pendingInvitationsCount === 1 ? "" : "s"}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </Link>

            <Link href="/advisor/settings" className="group">
              <div className="h-full rounded-lg border bg-background p-5 transition-colors hover:bg-muted/50">
                <div className="flex items-start gap-4">
                  <div className="rounded-md bg-muted p-2">
                    <Settings className="h-5 w-5 text-foreground" aria-hidden />
                  </div>
                  <div className="space-y-1">
                    <h4 className="font-semibold group-hover:text-primary">Settings</h4>
                    <p className="text-sm text-muted-foreground">Branding and preferences</p>
                  </div>
                </div>
              </div>
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}

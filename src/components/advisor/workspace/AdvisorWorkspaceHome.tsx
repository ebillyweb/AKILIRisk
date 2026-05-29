import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import {
  ArrowRight,
  GitBranch,
  Send,
  Settings,
  Radio,
  UserPlus,
} from "lucide-react";
import { UnauthorizedNotice } from "@/components/layout/UnauthorizedNotice";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { getAdvisorWorkspaceHomeData } from "@/lib/actions/advisor-workspace-actions";
import { MetricCard } from "./MetricCard";
import type {
  AdvisorActivityItem,
  AdvisorIntelligenceHighlight,
  AdvisorPriorityItem,
} from "@/lib/advisor/workspace-data";
import type { PipelineMetrics } from "@/lib/pipeline/types";

type WorkspaceData = Extract<
  Awaited<ReturnType<typeof getAdvisorWorkspaceHomeData>>,
  { success: true }
>["data"];

function PriorityQueueItem({ item }: { item: AdvisorPriorityItem }) {
  return (
    <Link
      href={item.href}
      className="group flex items-start justify-between gap-3 rounded-lg border border-border/60 bg-background px-3 py-2.5 transition-colors hover:border-primary/30 hover:bg-muted/40"
    >
      <div className="min-w-0 space-y-0.5">
        <p className="text-sm font-medium text-foreground group-hover:text-primary">
          {item.title}
        </p>
        <p className="text-xs text-muted-foreground leading-relaxed">{item.description}</p>
      </div>
      {item.count != null && (
        <Badge variant="secondary" className="shrink-0 tabular-nums">
          {item.count}
        </Badge>
      )}
    </Link>
  );
}

function ActivityFeedItem({ item }: { item: AdvisorActivityItem }) {
  return (
    <Link
      href={item.href}
      className="block rounded-lg border border-border/50 px-3 py-2 transition-colors hover:bg-muted/40"
    >
      <div className="flex items-center justify-between gap-2">
        <p className={cnText(item.read)}>{item.title}</p>
        <time className="shrink-0 text-[10px] text-muted-foreground">
          {item.createdAt.toLocaleDateString()}
        </time>
      </div>
      <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{item.message}</p>
    </Link>
  );
}

function cnText(read: boolean) {
  return read
    ? "text-sm text-muted-foreground"
    : "text-sm font-medium text-foreground";
}

function IntelligenceCard({ item }: { item: AdvisorIntelligenceHighlight }) {
  return (
    <Link
      href={item.href}
      className="group block rounded-lg border border-border/70 bg-gradient-to-br from-primary/[0.04] to-transparent p-4 transition-colors hover:border-primary/25"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold text-foreground group-hover:text-primary">
          {item.title}
        </p>
        {item.severity === "critical" && (
          <Badge variant="warning" className="shrink-0 text-[10px]">
            Critical
          </Badge>
        )}
      </div>
      <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{item.description}</p>
    </Link>
  );
}

function PipelineSnapshot({ metrics, pendingInvitations }: { metrics: PipelineMetrics; pendingInvitations: number }) {
  const byStage = metrics.byStage;
  const activeInFlight =
    (byStage.INTAKE_IN_PROGRESS ?? 0) + (byStage.ASSESSMENT_IN_PROGRESS ?? 0);

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
      <MetricCard label="Assigned clients" value={metrics.total} />
      <MetricCard label="Pending invitations" value={pendingInvitations} />
      <MetricCard label="Awaiting review" value={byStage.INTAKE_COMPLETE ?? 0} />
      <MetricCard label="Intake / assessment active" value={activeInFlight} />
      <MetricCard label="Need documents" value={metrics.documentsNeeded} />
      <MetricCard label="Stalled (7+ days)" value={metrics.stalled} />
    </div>
  );
}

function QuickActionButton({
  href,
  label,
  description,
  icon: Icon,
}: {
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
}) {
  return (
    <Button asChild variant="outline" className="h-auto min-h-[4.5rem] justify-start px-4 py-3">
      <Link href={href} className="flex w-full items-start gap-3 text-left">
        <Icon className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
        <span className="min-w-0">
          <span className="block text-sm font-medium">{label}</span>
          <span className="block text-xs font-normal text-muted-foreground">{description}</span>
        </span>
      </Link>
    </Button>
  );
}

interface AdvisorWorkspaceHomeProps {
  data: WorkspaceData;
  error?: string;
}

export function AdvisorWorkspaceHome({ data, error }: AdvisorWorkspaceHomeProps) {
  const { profile, metrics, priorities, activity, intelligenceHighlights, flags } = data;
  const firstName = profile.user.firstName;
  const firmName = profile.firmName;

  return (
    <div className="space-y-6">
      <UnauthorizedNotice error={error} />

      <header className="space-y-1 border-b border-border/50 pb-5">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Advisor Workspace
        </p>
        <h2 className="text-2xl font-semibold tracking-tight text-foreground">
          Today
        </h2>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Welcome back
          {firstName ? `, ${firstName}` : ""}
          {firmName ? ` · ${firmName}` : ""}. Your pipeline, priorities, and intelligence
          signals in one place.
        </p>
        <div className="flex flex-wrap gap-2 pt-3">
          <Button asChild size="sm">
            <Link href="/advisor/pipeline" className="inline-flex items-center gap-2">
              <GitBranch className="size-4" />
              Open pipeline
              <ArrowRight className="size-4 opacity-70" />
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/advisor/invitations" className="inline-flex items-center gap-2">
              <UserPlus className="size-4" />
              Invite client
            </Link>
          </Button>
        </div>
      </header>

      {!data.pipelineOk && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-100">
          Could not load pipeline metrics.{" "}
          <Link href="/advisor/pipeline" className="font-medium underline underline-offset-2">
            Open pipeline
          </Link>
          {data.pipelineError ? ` (${data.pipelineError})` : null}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-border/70 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Today&apos;s priorities</CardTitle>
            <CardDescription>Items that need your attention first</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {priorities.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No urgent items — you&apos;re caught up.
              </p>
            ) : (
              priorities.map((item) => <PriorityQueueItem key={item.id} item={item} />)
            )}
          </CardContent>
        </Card>

        <Card className="border-border/70 shadow-sm">
          <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
            <div>
              <CardTitle className="text-base">Recent client activity</CardTitle>
              <CardDescription>Latest notifications from your practice</CardDescription>
            </div>
            <Button asChild variant="ghost" size="sm" className="shrink-0">
              <Link href="/advisor/notifications">View all</Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {activity.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No recent activity.</p>
            ) : (
              activity.map((item) => <ActivityFeedItem key={item.id} item={item} />)
            )}
          </CardContent>
        </Card>
      </div>

      {metrics && (
        <Card className="border-border/70 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <div>
              <CardTitle className="text-base">Pipeline snapshot</CardTitle>
              <CardDescription>Counts across assigned clients</CardDescription>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link href="/advisor/pipeline">Full pipeline</Link>
            </Button>
          </CardHeader>
          <CardContent>
            <PipelineSnapshot
              metrics={metrics}
              pendingInvitations={data.pendingInvitationsCount}
            />
          </CardContent>
        </Card>
      )}

      {flags.riskIntelligenceEnabled && (
        <Card className="border-border/70 shadow-sm">
          <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
            <div>
              <CardTitle className="text-base">Intelligence highlights</CardTitle>
              <CardDescription>
                Recent portfolio changes — open Signals for the full feed
              </CardDescription>
            </div>
            <Button asChild variant="ghost" size="sm" className="shrink-0">
              <Link href="/advisor/signals" className="inline-flex items-center gap-1">
                <Radio className="size-3.5" />
                All signals
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {intelligenceHighlights.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">
                Complete client assessments to populate portfolio intelligence.
              </p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {intelligenceHighlights.map((item) => (
                  <IntelligenceCard key={item.id} item={item} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card className="border-border/70 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Quick actions</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <QuickActionButton
            href="/advisor/pipeline"
            label="Pipeline"
            description="Stages, filters, and client drill-down"
            icon={GitBranch}
          />
          <QuickActionButton
            href="/advisor/invitations"
            label="Invitations"
            description="Send and track client invites"
            icon={Send}
          />
          <QuickActionButton
            href="/advisor/settings"
            label="Settings"
            description="Branding and practice preferences"
            icon={Settings}
          />
        </CardContent>
      </Card>
    </div>
  );
}

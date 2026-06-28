import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { ClientLimitBanner } from "@/components/advisor/billing/ClientLimitGate";
import { PipelinePageToolbar } from "@/components/advisor/pipeline/PipelinePageToolbar";
import { getAdvisorClientLimitStatus } from "@/lib/advisor/client-limit-status.server";
import { auth } from "@/lib/auth";
import { getClientPipelineData } from "@/lib/actions/pipeline-actions";
import {
  legacyPipelineSearchRedirect,
  parsePipelineFiltersFromSearchParams,
  parsePipelinePageFromSearchParams,
} from "@/lib/pipeline/parse-pipeline-filters";
import type { PipelineFilters } from "@/lib/pipeline/types";
import { STALE_SCORES_COPY } from "@/lib/advisor/assessment-lifecycle-copy";
import { MetricCard } from "@/components/advisor/workspace/MetricCard";
import { PipelineView } from "./PipelineView";
import PipelineLoading from "./loading";

function pipelineWorkflowHeading(filters: PipelineFilters): {
  kicker: string;
  title: string;
  subtitle: string;
} | null {
  if (filters.awaitingIntakeReview) {
    return {
      kicker: "Workflow",
      title: "Intake review queue",
      subtitle:
        "Clients who submitted intake and are waiting for your approval before assessment.",
    };
  }
  if (filters.documentsNeeded) {
    return {
      kicker: "Workflow",
      title: "Document Requests",
      subtitle:
        "Clients with mandatory document requirements still outstanding.",
    };
  }
  if (filters.staleScores) {
    return {
      kicker: "Workflow",
      title: STALE_SCORES_COPY.pageTitle,
      subtitle: STALE_SCORES_COPY.pageSubtitle,
    };
  }
  if (filters.stalled) {
    return {
      kicker: "Workflow",
      title: "Stalled clients",
      subtitle: "Assigned clients with no activity in the last 7 days.",
    };
  }
  if (filters.inactive) {
    return {
      kicker: "Clients",
      title: "All Clients",
      subtitle:
        "Inactive workflows you ended. Restore any client to return them to your active pipeline.",
    };
  }
  return null;
}

function MetricsSummary({ metrics }: { metrics: any }) {
  const metricCards = [
    {
      label: "Invited",
      count: metrics.byStage.INVITED,
      className:
        "border-blue-200/70 bg-blue-50/80 dark:border-blue-800/40 dark:bg-blue-950/25",
    },
    {
      label: "Registered",
      count: metrics.byStage.REGISTERED,
      className:
        "border-indigo-200/70 bg-indigo-50/80 dark:border-indigo-800/40 dark:bg-indigo-950/25",
    },
    {
      label: "Intake",
      count: metrics.byStage.INTAKE_IN_PROGRESS,
      className:
        "border-amber-200/70 bg-amber-50/80 dark:border-amber-800/40 dark:bg-amber-950/25",
    },
    {
      label: "Assessment",
      count: metrics.byStage.ASSESSMENT_IN_PROGRESS,
      className:
        "border-orange-200/70 bg-orange-50/80 dark:border-orange-800/40 dark:bg-orange-950/25",
    },
    {
      label: "Completed",
      count: metrics.byStage.COMPLETE,
      className:
        "border-emerald-200/70 bg-emerald-50/80 dark:border-emerald-800/40 dark:bg-emerald-950/25",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {metricCards.map((metric) => (
        <MetricCard
          key={metric.label}
          label={metric.label}
          value={metric.count}
          className={metric.className}
        />
      ))}
    </div>
  );
}

// Async component for data-dependent content
async function PipelineContent({
  initialFilters,
  initialPage,
}: {
  initialFilters: ReturnType<typeof parsePipelineFiltersFromSearchParams>;
  initialPage: number;
}) {
  const result = await getClientPipelineData({
    inactive: initialFilters.inactive === true,
  });

  if (!result.success) {
    return (
      <div className="space-y-6">
        <div className="text-center py-12">
          <p className="text-destructive text-sm">
            Error loading pipeline data: {result.error}
          </p>
        </div>
      </div>
    );
  }

  const { clients, metrics, profile } = result.data!;

  return (
    <div className="space-y-6">
      {/* Metrics summary */}
      <div className="rounded-lg border bg-card p-4" data-tour="pipeline-overview">
        <h2 className="mb-3 text-sm font-medium text-muted-foreground">
          Pipeline Overview
        </h2>
        <MetricsSummary metrics={metrics} />
      </div>

      {/* Pipeline view with real-time updates */}
      <PipelineView
        initialClients={clients}
        initialMetrics={metrics}
        initialFilters={initialFilters}
        initialPage={initialPage}
      />
    </div>
  );
}

export default async function PipelinePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams = await searchParams;
  const legacyRedirect = legacyPipelineSearchRedirect(resolvedSearchParams);
  if (legacyRedirect) {
    redirect(legacyRedirect);
  }

  const initialFilters = parsePipelineFiltersFromSearchParams(resolvedSearchParams);
  const initialPage = parsePipelinePageFromSearchParams(resolvedSearchParams);

  const workflowHeading = pipelineWorkflowHeading(initialFilters);
  const session = await auth();
  const clientLimitStatus = session?.user?.id
    ? await getAdvisorClientLimitStatus(session.user.id)
    : null;

  return (
    <div className="space-y-6 sm:space-y-8">
      {clientLimitStatus ? <ClientLimitBanner status={clientLimitStatus} /> : null}
      {clientLimitStatus ? <PipelinePageToolbar clientLimitStatus={clientLimitStatus} /> : null}

      {workflowHeading ? (
        <header className="space-y-1 border-b border-border/50 pb-5">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {workflowHeading.kicker}
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            {workflowHeading.title}
          </h1>
          <p className="max-w-2xl text-sm text-muted-foreground">{workflowHeading.subtitle}</p>
          <p className="pt-2 text-sm">
            <Link
              href="/advisor/pipeline"
              className="font-medium text-primary underline-offset-2 hover:underline"
            >
              View full pipeline
            </Link>
          </p>
        </header>
      ) : null}

      {/* Data-dependent content with Suspense streaming */}
      <Suspense fallback={<PipelineLoading />}>
        <PipelineContent initialFilters={initialFilters} initialPage={initialPage} />
      </Suspense>
    </div>
  );
}
import { Suspense } from "react";
import Link from "next/link";

import { getClientPipelineData } from "@/lib/actions/pipeline-actions";
import { parsePipelineFiltersFromSearchParams } from "@/lib/pipeline/parse-pipeline-filters";
import type { PipelineFilters } from "@/lib/pipeline/types";
import { PipelineView } from "./PipelineView";
import PipelineLoading from "./loading";

function pipelineWorkflowHeading(filters: PipelineFilters): {
  kicker: string;
  title: string;
  subtitle: string;
} | null {
  if (filters.awaitingIntakeReview) {
    return {
      kicker: "Workflows",
      title: "Intake review queue",
      subtitle:
        "Clients who submitted intake and are waiting for your approval before assessment.",
    };
  }
  if (filters.documentsNeeded) {
    return {
      kicker: "Workflows",
      title: "Document requests",
      subtitle:
        "Clients with mandatory document requirements still outstanding.",
    };
  }
  if (filters.stalled) {
    return {
      kicker: "Workflows",
      title: "Stalled clients",
      subtitle: "Assigned clients with no activity in the last 7 days.",
    };
  }
  return null;
}

// Metrics summary component
function MetricsSummary({ metrics }: { metrics: any }) {
  const metricCards = [
    { label: 'Invited', count: metrics.byStage.INVITED, color: 'bg-blue-50' },
    { label: 'Registered', count: metrics.byStage.REGISTERED, color: 'bg-indigo-50' },
    { label: 'Intake', count: metrics.byStage.INTAKE_IN_PROGRESS, color: 'bg-amber-50' },
    { label: 'Assessment', count: metrics.byStage.ASSESSMENT_IN_PROGRESS, color: 'bg-orange-50' },
    { label: 'Documents', count: metrics.byStage.DOCUMENTS_REQUIRED, color: 'bg-yellow-50' },
    { label: 'Complete', count: metrics.byStage.COMPLETE, color: 'bg-green-50' },
    { label: 'Stalled', count: metrics.stalled, color: 'bg-red-50' },
    { label: 'Total', count: metrics.total, color: 'bg-gray-50' },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
      {metricCards.map((metric) => (
        <div key={metric.label} className={`rounded-md ${metric.color} px-3 py-2 text-center`}>
          <p className="text-lg font-semibold">{metric.count}</p>
          <p className="text-xs text-muted-foreground">{metric.label}</p>
        </div>
      ))}
    </div>
  );
}

// Async component for data-dependent content
async function PipelineContent({
  initialFilters,
}: {
  initialFilters: ReturnType<typeof parsePipelineFiltersFromSearchParams>;
}) {
  const result = await getClientPipelineData();

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
      <div className="rounded-lg border bg-card p-4">
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
  const initialFilters = parsePipelineFiltersFromSearchParams(resolvedSearchParams);
  const workflowHeading = pipelineWorkflowHeading(initialFilters);

  return (
    <div className="space-y-6 sm:space-y-8">
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

      {/* Quick navigation */}
      <div className="flex justify-center">
        <Link
          href="/advisor/invitations"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          Send new invitations
        </Link>
      </div>

      {/* Data-dependent content with Suspense streaming */}
      <Suspense fallback={<PipelineLoading />}>
        <PipelineContent initialFilters={initialFilters} />
      </Suspense>
    </div>
  );
}
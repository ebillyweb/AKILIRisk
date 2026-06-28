"use client";

import { AdvisorHeaderActions } from "@/components/advisor/layout/AdvisorHeaderActions";
import { PipelineClientActions } from "@/components/advisor/pipeline/PipelineClientActions";
import type { ClientLimitSnapshot } from "@/lib/billing/client-limit";

export function PipelinePageToolbar({
  clientLimitStatus,
}: {
  clientLimitStatus: ClientLimitSnapshot;
}) {
  return (
    <div
      className="mb-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2"
      data-tour="pipeline-client-actions"
    >
      <PipelineClientActions clientLimitStatus={clientLimitStatus} />
      <AdvisorHeaderActions className="shrink-0" />
    </div>
  );
}

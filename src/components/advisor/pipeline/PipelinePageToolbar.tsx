"use client";

import { ProductTourButton } from "@/components/product-tour/ProductTourButton";
import { PipelineClientActions } from "@/components/advisor/pipeline/PipelineClientActions";
import type { ClientLimitSnapshot } from "@/lib/billing/client-limit";

export function PipelinePageToolbar({
  clientLimitStatus,
}: {
  clientLimitStatus: ClientLimitSnapshot;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div data-tour="pipeline-client-actions">
        <PipelineClientActions clientLimitStatus={clientLimitStatus} />
      </div>
      <ProductTourButton tourId="advisor-pipeline" autoStart />
    </div>
  );
}

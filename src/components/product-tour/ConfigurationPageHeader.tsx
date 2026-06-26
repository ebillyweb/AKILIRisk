"use client";

import type { TourId } from "@/lib/product-tour/types";
import { ProductTourButton } from "@/components/product-tour/ProductTourButton";

type ConfigurationPageHeaderProps = {
  tourId: TourId;
  title: string;
  description?: string;
  /** Show auto-start tour on first visit (default true). */
  autoStart?: boolean;
};

export function ConfigurationPageHeader({
  tourId,
  title,
  description,
  autoStart = true,
}: ConfigurationPageHeaderProps) {
  return (
    <div className="space-y-1" data-tour="config-page-header">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <ProductTourButton tourId={tourId} autoStart={autoStart} />
      </div>
      {description ? (
        <p className="text-sm text-muted-foreground">{description}</p>
      ) : null}
    </div>
  );
}

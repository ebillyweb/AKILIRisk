"use client";

import type { TourId } from "@/lib/product-tour/types";

import { AdvisorScreenHeader } from "@/components/advisor/layout/AdvisorScreenHeader";

type ConfigurationPageHeaderProps = {
  tourId?: TourId;
  title: string;
  description?: string;
  kicker?: string;
  /** Show auto-start tour on first visit (default true). */
  autoStart?: boolean;
  borderBottom?: boolean;
};

/**
 * Configuration screens use the shared advisor header chrome.
 * Plan badge and Take a tour render from AdvisorSubscreenToolbar in the layout.
 */
export function ConfigurationPageHeader({
  title,
  description,
  kicker,
  borderBottom = false,
}: ConfigurationPageHeaderProps) {
  return (
    <AdvisorScreenHeader
      kicker={kicker}
      title={title}
      description={description}
      borderBottom={borderBottom}
    />
  );
}

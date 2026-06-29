"use client";

import { usePathname } from "next/navigation";

import { ProductTourButton } from "@/components/product-tour/ProductTourButton";
import { getAdvisorTourIdForPath } from "@/lib/product-tour/advisor-path-tours";
import type { TourId } from "@/lib/product-tour/types";
import { cn } from "@/lib/utils";

type AdvisorHeaderActionsProps = {
  tourId?: TourId | null;
  autoStartTour?: boolean;
  className?: string;
};

export function AdvisorHeaderActions({
  tourId,
  autoStartTour = true,
  className,
}: AdvisorHeaderActionsProps) {
  const pathname = usePathname() ?? "";
  const resolvedTourId = tourId ?? getAdvisorTourIdForPath(pathname);

  if (!resolvedTourId) {
    return null;
  }

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <ProductTourButton tourId={resolvedTourId} autoStart={autoStartTour} />
    </div>
  );
}

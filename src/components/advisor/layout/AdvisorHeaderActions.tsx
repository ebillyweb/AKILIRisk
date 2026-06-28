"use client";

import { usePathname } from "next/navigation";

import { ProductTourButton } from "@/components/product-tour/ProductTourButton";
import { getAdvisorTourIdForPath } from "@/lib/product-tour/advisor-path-tours";
import type { TourId } from "@/lib/product-tour/types";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

import { useAdvisorWorkspace } from "./AdvisorWorkspaceContext";

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
  const { subscriptionTier } = useAdvisorWorkspace();
  const resolvedTourId = tourId ?? getAdvisorTourIdForPath(pathname);

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <Badge
        variant={subscriptionTier === "BUSINESS" ? "default" : "secondary"}
        className="px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide"
      >
        {subscriptionTier} plan
      </Badge>
      {resolvedTourId ? (
        <ProductTourButton tourId={resolvedTourId} autoStart={autoStartTour} />
      ) : null}
    </div>
  );
}

"use client";

import { useEffect } from "react";
import { CircleHelp } from "lucide-react";
import { startProductTour, hasSeenTour } from "@/lib/product-tour/run-tour";
import type { TourId } from "@/lib/product-tour/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ProductTourButtonProps = {
  tourId: TourId;
  /** Auto-launch once for first-time visitors (default true). */
  autoStart?: boolean;
  className?: string;
  label?: string;
  /** Icon-only control for dense headers and toolbars. */
  iconOnly?: boolean;
};

export function ProductTourButton({
  tourId,
  autoStart = true,
  className,
  label = "Take a tour",
  iconOnly = false,
}: ProductTourButtonProps) {
  useEffect(() => {
    if (!autoStart || hasSeenTour(tourId)) return;
    const timer = window.setTimeout(() => startProductTour(tourId), 600);
    return () => window.clearTimeout(timer);
  }, [autoStart, tourId]);

  return (
    <Button
      type="button"
      variant="outline"
      size={iconOnly ? "icon" : "sm"}
      className={cn("shrink-0", className)}
      onClick={() => startProductTour(tourId)}
      aria-label={iconOnly ? label : undefined}
    >
      <CircleHelp className={cn("h-4 w-4", !iconOnly && "mr-1.5")} aria-hidden />
      {iconOnly ? <span className="sr-only">{label}</span> : label}
    </Button>
  );
}

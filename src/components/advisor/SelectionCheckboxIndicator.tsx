"use client";

import { Check } from "lucide-react";

import { cn } from "@/lib/utils";

/** Visual-only checkbox for clickable row buttons (avoids nested <button> in Checkbox). */
export function SelectionCheckboxIndicator({
  checked,
  className,
}: {
  checked: boolean;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border border-primary ring-offset-background",
        checked && "bg-primary text-primary-foreground",
        className,
      )}
    >
      {checked ? <Check className="h-3 w-3" strokeWidth={3} /> : null}
    </span>
  );
}

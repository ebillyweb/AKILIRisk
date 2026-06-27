import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type LandingSectionBandProps = {
  children: ReactNode;
  className?: string;
  /** Subtle inset band vs. flush with page background */
  variant?: "default" | "inset";
};

export function LandingSectionBand({
  children,
  className,
  variant = "default",
}: LandingSectionBandProps) {
  return (
    <div
      className={cn(
        variant === "inset" &&
          "rounded-[1.75rem] border border-border/60 bg-card/40 px-6 py-10 sm:px-10 sm:py-12",
        className,
      )}
    >
      {children}
    </div>
  );
}

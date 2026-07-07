import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type MarketingSurfaceCardProps = {
  children: ReactNode;
  className?: string;
  as?: "div" | "article";
};

export function MarketingSurfaceCard({
  children,
  className,
  as: Component = "div",
}: MarketingSurfaceCardProps) {
  return (
    <Component
      className={cn(
        "marketing-card rounded-[1.25rem] border border-border/70 bg-card/80 px-5 py-5 sm:px-6 sm:py-6",
        className,
      )}
    >
      {children}
    </Component>
  );
}

import { Check, Minus } from "lucide-react";

import {
  TIER_CATALOG,
  type SelfServeTier,
} from "@/lib/billing/tier-catalog";
import { cn } from "@/lib/utils";

type PlanTierFeatureListProps = {
  tier: SelfServeTier;
  /** minimal: homepage preview; compact: billing + pricing cards; full: legacy long list. */
  variant?: "minimal" | "compact" | "full";
  className?: string;
};

export function PlanTierFeatureList({
  tier,
  variant = "compact",
  className,
}: PlanTierFeatureListProps) {
  const catalog = TIER_CATALOG[tier];
  const includes =
    variant === "full"
      ? catalog.highlights
      : variant === "minimal"
        ? catalog.cardIncludes.slice(0, 2)
        : catalog.cardIncludes;
  const excludes = variant === "compact" ? catalog.cardExcludes : undefined;

  return (
    <div className={cn("space-y-3", className)}>
      <ul className="space-y-2">
        {includes.map((item) => (
          <li
            key={item}
            className="flex gap-2 text-sm leading-5 text-muted-foreground"
          >
            <Check
              className="mt-0.5 size-3.5 shrink-0 text-brand"
              aria-hidden
            />
            <span>{item}</span>
          </li>
        ))}
      </ul>

      {excludes && excludes.length > 0 ? (
        <ul className="space-y-1.5 border-t border-border/50 pt-3">
          {excludes.map((item) => (
            <li
              key={item}
              className="flex gap-2 text-xs leading-5 text-muted-foreground/85"
            >
              <Minus
                className="mt-0.5 size-3 shrink-0 text-muted-foreground/60"
                aria-hidden
              />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

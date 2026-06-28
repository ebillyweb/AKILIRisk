"use client";

import { cn } from "@/lib/utils";

type AdvisorScreenHeaderProps = {
  kicker?: string;
  title: string;
  description?: string;
  borderBottom?: boolean;
  className?: string;
};

export function AdvisorScreenHeader({
  kicker,
  title,
  description,
  borderBottom = true,
  className,
}: AdvisorScreenHeaderProps) {
  return (
    <header
      className={cn(
        "space-y-1",
        borderBottom && "border-b border-border/50 pb-5",
        className,
      )}
      data-tour="config-page-header"
    >
      {kicker ? (
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {kicker}
        </p>
      ) : null}
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
      {description ? (
        <p className="max-w-2xl text-sm text-muted-foreground">{description}</p>
      ) : null}
    </header>
  );
}

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type MarketingPageHeroProps = {
  kicker: string;
  title: string;
  description?: string;
  meta?: ReactNode;
  className?: string;
};

export function MarketingPageHero({
  kicker,
  title,
  description,
  meta,
  className,
}: MarketingPageHeroProps) {
  return (
    <header
      className={cn(
        "relative overflow-hidden rounded-[2rem] border border-border/60 bg-card/70 px-6 py-10 sm:px-10 sm:py-12",
        className,
      )}
    >
      <div
        className="pointer-events-none absolute -right-16 -top-20 size-72 rounded-full bg-brand/10 blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -bottom-24 -left-10 size-64 rounded-full bg-trust-accent/10 blur-3xl"
        aria-hidden
      />
      <div className="relative max-w-3xl space-y-4">
        <p className="editorial-kicker">{kicker}</p>
        <h1 className="font-display text-4xl font-semibold leading-tight tracking-tight text-foreground sm:text-5xl">
          {title}
        </h1>
        {description ? (
          <p className="text-base leading-7 text-muted-foreground sm:text-lg">
            {description}
          </p>
        ) : null}
        {meta}
      </div>
    </header>
  );
}

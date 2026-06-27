import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type MarketingSectionProps = {
  id?: string;
  kicker?: string;
  title: string;
  description?: string;
  children?: ReactNode;
  className?: string;
  headerClassName?: string;
  align?: "left" | "center";
};

export function MarketingSection({
  id,
  kicker,
  title,
  description,
  children,
  className,
  headerClassName,
  align = "left",
}: MarketingSectionProps) {
  const centered = align === "center";

  return (
    <section
      id={id}
      className={cn("scroll-mt-24 space-y-8 sm:space-y-10", className)}
      aria-labelledby={id ? `${id}-heading` : undefined}
    >
      <header
        className={cn(
          "space-y-3",
          centered && "mx-auto max-w-3xl text-center",
          headerClassName,
        )}
      >
        {kicker ? <p className="editorial-kicker">{kicker}</p> : null}
        <h2
          id={id ? `${id}-heading` : undefined}
          className="font-display text-3xl font-semibold leading-tight tracking-tight text-foreground sm:text-4xl"
        >
          {title}
        </h2>
        {description ? (
          <p
            className={cn(
              "max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg",
              centered && "mx-auto",
            )}
          >
            {description}
          </p>
        ) : null}
      </header>
      {children}
    </section>
  );
}

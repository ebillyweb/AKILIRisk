import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface WorkspaceCardProps {
  href: string;
  title: string;
  description: string;
  icon: LucideIcon;
  badge?: {
    text: string;
    variant?: "default" | "secondary" | "outline";
  };
  className?: string;
}

export function WorkspaceCard({
  href,
  title,
  description,
  icon: Icon,
  badge,
  className,
}: WorkspaceCardProps) {
  return (
    <Link
      href={href}
      className={cn(
        "group block h-full rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        className
      )}
    >
      <article className="hero-surface relative flex h-full flex-col gap-3 rounded-2xl border border-border/80 bg-card p-4 pb-10 shadow-sm transition-all duration-200 ease-out group-hover:-translate-y-0.5 group-hover:border-border group-hover:shadow-md">
        <div className="flex items-start justify-between gap-2">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-muted/40 text-muted-foreground transition-colors group-hover:border-primary/25 group-hover:bg-primary/5 group-hover:text-primary">
            <Icon className="size-4" aria-hidden />
          </span>
          {badge && (
            <span
              className={cn(
                "inline-flex shrink-0 items-center whitespace-nowrap rounded-md px-2 py-0.5 text-[11px] font-medium leading-5",
                badge.variant === "outline" &&
                  "border border-border/60 bg-background text-muted-foreground",
                badge.variant === "secondary" &&
                  "bg-secondary text-secondary-foreground",
                (!badge.variant || badge.variant === "default") &&
                  "bg-primary/10 text-primary"
              )}
            >
              {badge.text}
            </span>
          )}
        </div>

        <div className="space-y-1">
          <h3 className="text-sm font-semibold leading-snug tracking-tight text-foreground">
            {title}
          </h3>
          <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
            {description}
          </p>
        </div>

        <ArrowUpRight
          className="absolute bottom-3 right-3 size-4 text-muted-foreground/60 transition-all duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-foreground"
          aria-hidden
        />
      </article>
    </Link>
  );
}

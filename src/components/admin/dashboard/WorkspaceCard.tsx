import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
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
        "group block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-lg",
        className
      )}
    >
      <Card className="h-full border border-border/80 bg-card shadow-sm transition-all duration-200 ease-out group-hover:-translate-y-0.5 group-hover:border-border group-hover:shadow-md">
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 flex-1 items-start gap-3">
              <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-muted/40 text-muted-foreground transition-colors group-hover:border-primary/25 group-hover:bg-primary/5 group-hover:text-primary">
                <Icon className="size-4 shrink-0" aria-hidden />
              </span>
              <div className="min-w-0 space-y-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold leading-snug tracking-tight text-foreground">
                    {title}
                  </h3>
                  {badge && (
                    <span className={cn(
                      "inline-flex items-center rounded-md px-2 py-1 text-xs font-medium",
                      badge.variant === "outline" && "border border-border/60 bg-background text-muted-foreground",
                      badge.variant === "secondary" && "bg-secondary text-secondary-foreground",
                      (!badge.variant || badge.variant === "default") && "bg-primary/10 text-primary"
                    )}>
                      {badge.text}
                    </span>
                  )}
                </div>
                <p className="text-xs leading-relaxed text-muted-foreground line-clamp-2">
                  {description}
                </p>
              </div>
            </div>
            <ArrowRight
              className="mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-foreground"
              aria-hidden
            />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
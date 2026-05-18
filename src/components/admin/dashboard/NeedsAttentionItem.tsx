import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type AlertSeverity = "low" | "medium" | "high" | "critical";

interface NeedsAttentionItemProps {
  title: string;
  description: string;
  severity: AlertSeverity;
  icon: LucideIcon;
  href?: string;
  actionLabel?: string;
  timestamp?: string;
  className?: string;
}

const severityStyles: Record<AlertSeverity, { badge: string; icon: string }> = {
  low: {
    badge: "bg-blue-50 text-blue-700 border-blue-200",
    icon: "text-blue-600 bg-blue-50 border-blue-200",
  },
  medium: {
    badge: "bg-amber-50 text-amber-700 border-amber-200",
    icon: "text-amber-600 bg-amber-50 border-amber-200",
  },
  high: {
    badge: "bg-orange-50 text-orange-700 border-orange-200",
    icon: "text-orange-600 bg-orange-50 border-orange-200",
  },
  critical: {
    badge: "bg-red-50 text-red-700 border-red-200",
    icon: "text-red-600 bg-red-50 border-red-200",
  },
};

const severityLabels: Record<AlertSeverity, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  critical: "Critical",
};

export function NeedsAttentionItem({
  title,
  description,
  severity,
  icon: Icon,
  href,
  actionLabel = "View details",
  timestamp,
  className,
}: NeedsAttentionItemProps) {
  const content = (
    <div
      className={cn(
        "flex items-start gap-4 p-4 rounded-lg border bg-card transition-colors",
        href && "hover:bg-muted/30 cursor-pointer",
        className
      )}
    >
      {/* Status Icon */}
      <div className={cn("rounded-lg p-2 border shrink-0", severityStyles[severity].icon)}>
        <Icon className="size-4" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 space-y-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-medium text-foreground text-sm truncate">
                {title}
              </h3>
              <Badge
                variant="outline"
                className={cn("text-xs shrink-0", severityStyles[severity].badge)}
              >
                {severityLabels[severity]}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {description}
            </p>
            {timestamp && (
              <p className="text-xs text-muted-foreground/80 mt-1">
                {timestamp}
              </p>
            )}
          </div>

          {/* Action */}
          {href && (
            <div className="shrink-0">
              <Button variant="ghost" size="sm" className="text-xs h-8">
                {actionLabel}
                <ArrowRight className="size-3 ml-1" />
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-lg">
        {content}
      </Link>
    );
  }

  return content;
}
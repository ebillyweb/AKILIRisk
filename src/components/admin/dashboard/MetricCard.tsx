import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type MetricStatus = "healthy" | "warning" | "critical" | "neutral";

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  status?: MetricStatus;
  trend?: {
    value: string;
    direction: "up" | "down" | "flat";
  };
  className?: string;
}

const statusStyles: Record<MetricStatus, string> = {
  healthy: "text-green-600 bg-green-50 border-green-200",
  warning: "text-amber-600 bg-amber-50 border-amber-200",
  critical: "text-red-600 bg-red-50 border-red-200",
  neutral: "text-muted-foreground bg-muted/30 border-border/60",
};

const trendStyles = {
  up: "text-green-600",
  down: "text-red-600",
  flat: "text-muted-foreground",
};

export function MetricCard({
  title,
  value,
  subtitle,
  icon: Icon,
  status = "neutral",
  trend,
  className,
}: MetricCardProps) {
  return (
    <Card className={cn("relative overflow-hidden", className)}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              {title}
            </p>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-foreground">
                {value}
              </span>
              {trend && (
                <span className={cn("text-xs font-medium", trendStyles[trend.direction])}>
                  {trend.direction === "up" && "↗"}
                  {trend.direction === "down" && "↘"}
                  {trend.direction === "flat" && "→"}
                  {trend.value}
                </span>
              )}
            </div>
            {subtitle && (
              <p className="text-xs text-muted-foreground">
                {subtitle}
              </p>
            )}
          </div>
          <div className={cn("rounded-lg p-2 border", statusStyles[status])}>
            <Icon className="size-4" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
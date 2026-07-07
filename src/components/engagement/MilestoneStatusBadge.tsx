"use client";

import { Badge } from "@/components/ui/badge";

const STATUS_CONFIG: Record<string, { variant?: "outline" | "secondary"; className?: string; label: string }> = {
  NOT_STARTED: { variant: "outline", label: "not started" },
  IN_PROGRESS: { className: "bg-brand/10 text-brand-foreground border-brand/20", label: "in progress" },
  COMPLETED: { className: "bg-chart-2/15 text-foreground border-chart-2/30", label: "completed" },
  SKIPPED: { variant: "secondary", label: "skipped" },
  BLOCKED: { className: "bg-destructive/10 text-destructive border-destructive/20", label: "blocked" },
  DEFERRED: { className: "bg-chart-5/15 text-foreground border-chart-5/30", label: "deferred" },
};

export function MilestoneStatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status] ?? { variant: "outline" as const, label: status.toLowerCase().replace("_", " ") };

  return (
    <Badge
      variant={config.variant ?? "outline"}
      className={`h-5 text-[10px] ${config.className ?? ""}`}
    >
      {config.label}
    </Badge>
  );
}

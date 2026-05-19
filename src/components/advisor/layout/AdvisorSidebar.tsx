import { Briefcase } from "lucide-react";
import { cn } from "@/lib/utils";
import { NotificationBell } from "@/components/advisor/NotificationBell";
import type { AdvisorPlatformFeatureFlags } from "@/lib/platform/feature-flags";
import { AdvisorSidebarNav } from "./AdvisorSidebarNav";

interface AdvisorSidebarProps {
  featureFlags: AdvisorPlatformFeatureFlags;
  unreadNotificationCount: number;
  className?: string;
}

export function AdvisorSidebar({
  featureFlags,
  unreadNotificationCount,
  className,
}: AdvisorSidebarProps) {
  return (
    <aside
      className={cn("flex flex-col border-r border-border/60 bg-card", className)}
    >
      <div className="border-b border-border/60 p-6">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Briefcase className="size-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-foreground">
              Advisor Workspace
            </h2>
            <p className="text-xs text-muted-foreground">Practice operations</p>
          </div>
        </div>
      </div>

      <AdvisorSidebarNav featureFlags={featureFlags} />

      <div className="mt-auto border-t border-border/60 p-4">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">Alerts</p>
          <NotificationBell initialCount={unreadNotificationCount} />
        </div>
      </div>
    </aside>
  );
}

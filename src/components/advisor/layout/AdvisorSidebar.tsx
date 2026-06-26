import type { SubscriptionTier } from "@prisma/client";
import { Briefcase } from "lucide-react";

import type { ClientLimitSnapshot } from "@/lib/billing/client-limit";
import { ClientLimitUsageMeter } from "@/components/advisor/billing/ClientLimitGate";
import { cn } from "@/lib/utils";
import { NotificationBell } from "@/components/advisor/NotificationBell";
import type { AdvisorPlatformFeatureFlags } from "@/lib/platform/feature-flags";
import { AdvisorSidebarNav } from "./AdvisorSidebarNav";

interface AdvisorSidebarProps {
  featureFlags: AdvisorPlatformFeatureFlags;
  subscriptionTier: SubscriptionTier;
  clientLimitStatus: ClientLimitSnapshot | null;
  unreadNotificationCount: number;
  workspaceTitle: string;
  enterpriseTeamEnabled?: boolean;
  billingNavEnabled?: boolean;
  className?: string;
}

export function AdvisorSidebar({
  featureFlags,
  subscriptionTier,
  clientLimitStatus,
  unreadNotificationCount,
  workspaceTitle,
  enterpriseTeamEnabled = false,
  billingNavEnabled = true,
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
              {workspaceTitle}
            </h2>
            <p className="text-xs text-muted-foreground">Practice operations</p>
          </div>
        </div>
      </div>

      <AdvisorSidebarNav
        featureFlags={featureFlags}
        subscriptionTier={subscriptionTier}
        clientLimitStatus={clientLimitStatus}
        enterpriseTeamEnabled={enterpriseTeamEnabled}
        billingNavEnabled={billingNavEnabled}
      />

      <div className="mt-auto border-t border-border/60 p-4 space-y-3">
        {clientLimitStatus ? (
          <ClientLimitUsageMeter status={clientLimitStatus} compact />
        ) : null}
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">Alerts</p>
          <NotificationBell initialCount={unreadNotificationCount} />
        </div>
      </div>
    </aside>
  );
}

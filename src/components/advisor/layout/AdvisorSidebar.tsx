"use client";

import type { SubscriptionTier } from "@prisma/client";
import { Briefcase, PanelLeft, PanelLeftClose } from "lucide-react";

import type { ClientLimitSnapshot } from "@/lib/billing/client-limit";
import { ClientLimitUsageMeter } from "@/components/advisor/billing/ClientLimitGate";
import { AdvisorSubscriptionPlanBadge } from "@/components/advisor/layout/AdvisorSubscriptionPlanBadge";
import { useAdvisorSidebarCollapsed } from "@/components/advisor/layout/use-advisor-sidebar-collapsed";
import { cn } from "@/lib/utils";
import { NotificationBell } from "@/components/advisor/NotificationBell";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
  brandingNavEnabled?: boolean;
  implementationTrackingEnabled?: boolean;
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
  brandingNavEnabled = false,
  implementationTrackingEnabled = true,
  className,
}: AdvisorSidebarProps) {
  const { collapsed, toggle } = useAdvisorSidebarCollapsed();

  return (
    <TooltipProvider delayDuration={300}>
      <aside
        data-collapsed={collapsed ? "true" : "false"}
        className={cn(
          "flex flex-col border-r border-border/60 bg-card transition-[width] duration-200 ease-in-out",
          collapsed ? "w-[4.5rem]" : "w-64",
          className,
        )}
      >
        <div
          className={cn(
            "flex shrink-0 pt-3",
            collapsed ? "justify-center px-2" : "px-4",
          )}
        >
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8 text-muted-foreground hover:text-foreground"
            onClick={toggle}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-expanded={!collapsed}
          >
            {collapsed ? <PanelLeft className="size-4" /> : <PanelLeftClose className="size-4" />}
          </Button>
        </div>

        <div
          className={cn(
            "border-b border-border/60",
            collapsed ? "px-2 pb-3 pt-3" : "px-4 pb-5 pt-3",
          )}
        >
          <div
            className={cn(
              "flex gap-3",
              collapsed ? "flex-col items-center" : "items-start",
            )}
          >
            <Tooltip>
              <TooltipTrigger asChild>
                <div
                  className={cn(
                    "flex shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary",
                    collapsed ? "size-9" : "size-10",
                  )}
                >
                  <Briefcase className={collapsed ? "size-4" : "size-5"} />
                </div>
              </TooltipTrigger>
              {collapsed ? (
                <TooltipContent side="right" className="max-w-56">
                  <p className="font-medium">{workspaceTitle}</p>
                  <p className="text-xs text-muted-foreground">Practice operations</p>
                  <div className="mt-2">
                    <AdvisorSubscriptionPlanBadge subscriptionTier={subscriptionTier} />
                  </div>
                </TooltipContent>
              ) : null}
            </Tooltip>

            {!collapsed ? (
              <div className="min-w-0 flex-1">
                <h2
                  className={cn(
                    "text-pretty font-semibold leading-snug tracking-tight text-foreground break-words",
                    workspaceTitle.length > 32
                      ? "text-sm"
                      : workspaceTitle.length > 20
                        ? "text-base"
                        : "text-lg",
                  )}
                >
                  {workspaceTitle}
                </h2>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <p className="text-xs text-muted-foreground">Practice operations</p>
                  <AdvisorSubscriptionPlanBadge subscriptionTier={subscriptionTier} />
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <AdvisorSidebarNav
          featureFlags={featureFlags}
          subscriptionTier={subscriptionTier}
          clientLimitStatus={clientLimitStatus}
          enterpriseTeamEnabled={enterpriseTeamEnabled}
          billingNavEnabled={billingNavEnabled}
          brandingNavEnabled={brandingNavEnabled}
          implementationTrackingEnabled={implementationTrackingEnabled}
          collapsed={collapsed}
        />

        <div
          className={cn(
            "mt-auto space-y-3 border-t border-border/60",
            collapsed ? "p-2" : "p-4",
          )}
        >
          {clientLimitStatus && !collapsed ? (
            <ClientLimitUsageMeter status={clientLimitStatus} compact />
          ) : null}
          <div
            className={cn(
              "flex items-center gap-2",
              collapsed ? "justify-center" : "justify-between",
            )}
          >
            {!collapsed ? <p className="text-xs text-muted-foreground">Alerts</p> : null}
            <NotificationBell initialCount={unreadNotificationCount} />
          </div>
        </div>
      </aside>
    </TooltipProvider>
  );
}

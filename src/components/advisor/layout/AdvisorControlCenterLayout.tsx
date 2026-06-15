import { ReactNode } from "react";
import {
  WorkspaceMainPadding,
  WorkspaceSiteFooterRow,
} from "@/components/layout/WorkspaceMainContent";
import { cn } from "@/lib/utils";
import type { AdvisorPlatformFeatureFlags } from "@/lib/platform/feature-flags";
import { AdvisorSidebar } from "./AdvisorSidebar";
import { AdvisorMobileNav } from "./AdvisorMobileNav";

interface AdvisorControlCenterLayoutProps {
  children: ReactNode;
  featureFlags: AdvisorPlatformFeatureFlags;
  unreadNotificationCount: number;
  workspaceTitle: string;
  enterpriseTeamEnabled?: boolean;
  billingNavEnabled?: boolean;
  className?: string;
}

export function AdvisorControlCenterLayout({
  children,
  featureFlags,
  unreadNotificationCount,
  workspaceTitle,
  enterpriseTeamEnabled = false,
  billingNavEnabled = true,
  className,
}: AdvisorControlCenterLayoutProps) {
  return (
    <div
      className={cn(
        "flex min-h-[calc(100vh-8rem)] flex-col bg-background -mx-4 sm:-mx-6 lg:-mx-8",
        className
      )}
    >
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <AdvisorSidebar
          featureFlags={featureFlags}
          unreadNotificationCount={unreadNotificationCount}
          workspaceTitle={workspaceTitle}
          enterpriseTeamEnabled={enterpriseTeamEnabled}
          billingNavEnabled={billingNavEnabled}
          className="hidden w-64 shrink-0 lg:flex"
        />

        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <AdvisorMobileNav
            featureFlags={featureFlags}
            unreadNotificationCount={unreadNotificationCount}
            workspaceTitle={workspaceTitle}
            enterpriseTeamEnabled={enterpriseTeamEnabled}
            billingNavEnabled={billingNavEnabled}
          />

          <main className="min-h-0 flex-1 overflow-y-auto">
            <WorkspaceMainPadding>{children}</WorkspaceMainPadding>
          </main>
        </div>
      </div>

      <WorkspaceSiteFooterRow />
    </div>
  );
}

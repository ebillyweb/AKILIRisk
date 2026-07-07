import { ReactNode } from "react";
import type { SubscriptionTier } from "@prisma/client";
import {
  WorkspaceMainPadding,
  WorkspaceSiteFooterRow,
} from "@/components/layout/WorkspaceMainContent";
import { cn } from "@/lib/utils";
import type { AdvisorPlatformFeatureFlags } from "@/lib/platform/feature-flags";
import type { ClientLimitSnapshot } from "@/lib/billing/client-limit";
import { AdvisorSidebar } from "./AdvisorSidebar";
import { AdvisorMobileNav } from "./AdvisorMobileNav";
import { AdvisorSubscreenToolbar } from "./AdvisorSubscreenToolbar";
import {
  AdvisorWorkspacePreferencesProvider,
  type AdvisorWorkspacePreferences,
} from "./AdvisorWorkspacePreferencesContext";

interface AdvisorControlCenterLayoutProps {
  children: ReactNode;
  featureFlags: AdvisorPlatformFeatureFlags;
  subscriptionTier: SubscriptionTier;
  clientLimitStatus: ClientLimitSnapshot | null;
  unreadNotificationCount: number;
  workspaceTitle: string;
  enterpriseTeamEnabled?: boolean;
  billingNavEnabled?: boolean;
  brandingNavEnabled?: boolean;
  implementationTrackingEnabled?: boolean;
  workspacePreferences: AdvisorWorkspacePreferences;
  className?: string;
}

export function AdvisorControlCenterLayout({
  children,
  featureFlags,
  subscriptionTier,
  clientLimitStatus,
  unreadNotificationCount,
  workspaceTitle,
  enterpriseTeamEnabled = false,
  billingNavEnabled = true,
  brandingNavEnabled = false,
  implementationTrackingEnabled = true,
  workspacePreferences,
  className,
}: AdvisorControlCenterLayoutProps) {
  return (
    <AdvisorWorkspacePreferencesProvider value={workspacePreferences}>
    <div
      className={cn(
        "flex min-h-[calc(100vh-8rem)] flex-col bg-background -mx-4 sm:-mx-6 lg:-mx-8",
        className
      )}
    >
      <div className="flex min-h-0 flex-1 overflow-hidden">
          <AdvisorSidebar
            featureFlags={featureFlags}
            subscriptionTier={subscriptionTier}
            clientLimitStatus={clientLimitStatus}
            unreadNotificationCount={unreadNotificationCount}
            workspaceTitle={workspaceTitle}
            enterpriseTeamEnabled={enterpriseTeamEnabled}
            billingNavEnabled={billingNavEnabled}
            brandingNavEnabled={brandingNavEnabled}
            implementationTrackingEnabled={implementationTrackingEnabled}
            className="hidden shrink-0 lg:flex"
          />

          <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
            <AdvisorMobileNav
              featureFlags={featureFlags}
              subscriptionTier={subscriptionTier}
              clientLimitStatus={clientLimitStatus}
              unreadNotificationCount={unreadNotificationCount}
              workspaceTitle={workspaceTitle}
              enterpriseTeamEnabled={enterpriseTeamEnabled}
              billingNavEnabled={billingNavEnabled}
              brandingNavEnabled={brandingNavEnabled}
              implementationTrackingEnabled={implementationTrackingEnabled}
            />

            <main className="min-h-0 flex-1 overflow-y-auto">
              <WorkspaceMainPadding>
                <AdvisorSubscreenToolbar />
                {children}
              </WorkspaceMainPadding>
            </main>
          </div>
        </div>

      <WorkspaceSiteFooterRow />
    </div>
    </AdvisorWorkspacePreferencesProvider>
  );
}

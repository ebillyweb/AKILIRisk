import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { AdvisorPlatformFeatureFlags } from "@/lib/platform/feature-flags";
import { AdvisorSidebar } from "./AdvisorSidebar";
import { AdvisorMobileNav } from "./AdvisorMobileNav";

interface AdvisorControlCenterLayoutProps {
  children: ReactNode;
  featureFlags: AdvisorPlatformFeatureFlags;
  unreadNotificationCount: number;
  className?: string;
}

export function AdvisorControlCenterLayout({
  children,
  featureFlags,
  unreadNotificationCount,
  className,
}: AdvisorControlCenterLayoutProps) {
  return (
    <div
      className={cn(
        "flex min-h-[calc(100vh-8rem)] bg-background -mx-4 sm:-mx-6 lg:-mx-8",
        className
      )}
    >
      <AdvisorSidebar
        featureFlags={featureFlags}
        unreadNotificationCount={unreadNotificationCount}
        className="hidden w-64 shrink-0 lg:flex"
      />

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <AdvisorMobileNav
          featureFlags={featureFlags}
          unreadNotificationCount={unreadNotificationCount}
        />

        <main className="flex-1 overflow-hidden">
          <div className="h-full overflow-y-auto">
            <div className="p-4 sm:p-6 lg:p-8">{children}</div>
          </div>
        </main>
      </div>
    </div>
  );
}

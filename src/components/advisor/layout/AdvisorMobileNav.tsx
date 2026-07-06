"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Briefcase, Menu, X } from "lucide-react";
import type { SubscriptionTier } from "@prisma/client";

import type { ClientLimitSnapshot } from "@/lib/billing/client-limit";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { NotificationBell } from "@/components/advisor/NotificationBell";
import { AdvisorSubscriptionPlanBadge } from "@/components/advisor/layout/AdvisorSubscriptionPlanBadge";
import type { AdvisorPlatformFeatureFlags } from "@/lib/platform/feature-flags";
import { AdvisorSidebarNav } from "./AdvisorSidebarNav";

interface AdvisorMobileNavProps {
  featureFlags: AdvisorPlatformFeatureFlags;
  subscriptionTier: SubscriptionTier;
  clientLimitStatus: ClientLimitSnapshot | null;
  unreadNotificationCount: number;
  workspaceTitle: string;
  enterpriseTeamEnabled?: boolean;
  billingNavEnabled?: boolean;
  brandingNavEnabled?: boolean;
  implementationTrackingEnabled?: boolean;
}

export function AdvisorMobileNav({
  featureFlags,
  subscriptionTier,
  clientLimitStatus,
  unreadNotificationCount,
  workspaceTitle,
  enterpriseTeamEnabled = false,
  billingNavEnabled = true,
  brandingNavEnabled = false,
  implementationTrackingEnabled = true,
}: AdvisorMobileNavProps) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const close = useCallback(() => setOpen(false), []);

  const toggleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const debouncedToggle = useCallback(() => {
    if (toggleTimeoutRef.current) clearTimeout(toggleTimeoutRef.current);
    toggleTimeoutRef.current = setTimeout(() => setOpen((prev) => !prev), 50);
  }, []);

  useEffect(() => {
    return () => {
      if (toggleTimeoutRef.current) clearTimeout(toggleTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, close]);

  return (
    <>
      <div className="sticky top-0 z-40 flex items-center gap-3 border-b border-border/60 bg-card/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-card/80 lg:hidden">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-11 w-11 shrink-0"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={debouncedToggle}
        >
          <Menu className="size-4" />
          <span className="sr-only">
            {open ? "Close navigation menu" : "Open navigation menu"}
          </span>
        </Button>
        <div className="min-w-0 flex-1">
          <p
            className={cn(
              "text-pretty font-semibold leading-snug text-foreground break-words",
              workspaceTitle.length > 28 ? "text-xs" : "text-sm",
            )}
          >
            {workspaceTitle}
          </p>
          <div className="mt-0.5 flex flex-wrap items-center gap-2">
            <p className="truncate text-xs text-muted-foreground">Practice operations</p>
            <AdvisorSubscriptionPlanBadge subscriptionTier={subscriptionTier} />
          </div>
        </div>
        <NotificationBell initialCount={unreadNotificationCount} />
      </div>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-background/80 backdrop-blur-sm"
            aria-label="Close navigation menu"
            onClick={close}
          />
          <aside
            id={panelId}
            role="dialog"
            aria-modal="true"
            aria-label="Advisor navigation"
            className={cn(
              "absolute inset-y-0 left-0 flex w-[min(100vw-2rem,20rem)] flex-col",
              "border-r border-border/60 bg-card shadow-xl",
              "animate-in slide-in-from-left duration-200"
            )}
          >
            <div className="flex items-start justify-between gap-3 border-b border-border/60 p-4">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Briefcase className="size-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p
                    className={cn(
                      "text-pretty font-semibold leading-snug text-foreground break-words",
                      workspaceTitle.length > 32
                        ? "text-sm"
                        : workspaceTitle.length > 20
                          ? "text-base"
                          : "text-lg",
                    )}
                  >
                    {workspaceTitle}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <p className="text-xs text-muted-foreground">Practice operations</p>
                    <AdvisorSubscriptionPlanBadge subscriptionTier={subscriptionTier} />
                  </div>
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-11 w-11 shrink-0"
                onClick={close}
              >
                <X className="size-4" />
                <span className="sr-only">Close navigation menu</span>
              </Button>
            </div>

            <AdvisorSidebarNav
              featureFlags={featureFlags}
              subscriptionTier={subscriptionTier}
              clientLimitStatus={clientLimitStatus}
              enterpriseTeamEnabled={enterpriseTeamEnabled}
              billingNavEnabled={billingNavEnabled}
              brandingNavEnabled={brandingNavEnabled}
              implementationTrackingEnabled={implementationTrackingEnabled}
              collapsibleSections
              unifiedScroll
              onNavigate={close}
              className="min-h-0 flex-1"
            />
          </aside>
        </div>
      )}
    </>
  );
}

"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { SubscriptionTier } from "@prisma/client";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { AdvisorPlatformFeatureFlags } from "@/lib/platform/feature-flags";
import type { ClientLimitSnapshot } from "@/lib/billing/client-limit";
import { ClientLimitUpgradeDialog } from "@/components/advisor/billing/ClientLimitGate";
import { TierFeatureLockIcon, TierFeatureUpgradeDialog } from "@/components/advisor/billing/TierFeatureUpgrade";
import {
  getActiveAdvisorNavHref,
  getAdvisorNavSectionForHref,
  getAdvisorNavItemLockReason,
  getVisibleAdvisorNavSections,
  type AdvisorNavItem,
  type AdvisorNavLockReason,
  type AdvisorNavSection,
} from "./advisor-nav";

interface AdvisorSidebarNavProps {
  featureFlags: AdvisorPlatformFeatureFlags;
  subscriptionTier: SubscriptionTier;
  clientLimitStatus: ClientLimitSnapshot | null;
  enterpriseTeamEnabled?: boolean;
  billingNavEnabled?: boolean;
  collapsibleSections?: boolean;
  onNavigate?: () => void;
  className?: string;
}

function NavItem({
  item,
  isActive,
  lockReason,
  onLockedClick,
  onNavigate,
}: {
  item: AdvisorNavItem;
  isActive: boolean;
  lockReason: AdvisorNavLockReason;
  onLockedClick: () => void;
  onNavigate?: () => void;
}) {
  const Icon = item.icon;
  const isLocked = lockReason !== null;
  const baseClass = cn(
    "flex w-full items-center gap-3 rounded-md px-2 py-2 text-sm font-medium transition-colors",
    item.disabled || isLocked
      ? isLocked
        ? "cursor-pointer text-muted-foreground hover:bg-muted/40 hover:text-foreground"
        : "cursor-not-allowed text-muted-foreground/50"
      : "hover:bg-muted/60 hover:text-foreground",
    !item.disabled && !isLocked && isActive
      ? "bg-muted text-foreground"
      : "text-muted-foreground"
  );

  if (item.disabled) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={baseClass} aria-disabled="true">
            <Icon className="size-4 shrink-0 opacity-60" />
            <span className="truncate">{item.label}</span>
          </span>
        </TooltipTrigger>
        <TooltipContent side="right">
          {item.comingSoonTooltip ?? "Coming soon"}
        </TooltipContent>
      </Tooltip>
    );
  }

  if (isLocked) {
    return (
      <button
        type="button"
        className={baseClass}
        onClick={onLockedClick}
        aria-label={`${item.label} — upgrade required`}
      >
        <Icon className="size-4 shrink-0 opacity-80" />
        <span className="truncate">{item.label}</span>
        <TierFeatureLockIcon className="ml-auto !opacity-100" />
      </button>
    );
  }

  return (
    <Link
      href={item.href!}
      onClick={onNavigate}
      className={baseClass}
      aria-current={isActive ? "page" : undefined}
    >
      <Icon className="size-4 shrink-0" />
      <span className="truncate">{item.label}</span>
    </Link>
  );
}

function NavLinks({
  section,
  activeHref,
  subscriptionTier,
  clientLimitStatus,
  onLockedClick,
  onNavigate,
}: {
  section: AdvisorNavSection;
  activeHref: string | undefined;
  subscriptionTier: SubscriptionTier;
  clientLimitStatus: ClientLimitSnapshot | null;
  onLockedClick: (item: AdvisorNavItem, reason: AdvisorNavLockReason) => void;
  onNavigate?: () => void;
}) {
  return (
    <div className="space-y-1">
      {section.items.map((item) => {
        const lockReason = getAdvisorNavItemLockReason(
          item,
          subscriptionTier,
          clientLimitStatus
        );
        const isActive = !item.disabled && lockReason === null && item.href === activeHref;
        return (
          <NavItem
            key={`${section.id}-${item.label}`}
            item={item}
            isActive={isActive}
            lockReason={lockReason}
            onLockedClick={() => onLockedClick(item, lockReason)}
            onNavigate={onNavigate}
          />
        );
      })}
    </div>
  );
}

export function AdvisorSidebarNav({
  featureFlags,
  subscriptionTier,
  clientLimitStatus,
  enterpriseTeamEnabled = false,
  billingNavEnabled = true,
  collapsibleSections = false,
  onNavigate,
  className,
}: AdvisorSidebarNavProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [navLock, setNavLock] = useState<AdvisorNavLockReason>(null);
  const visibleSections = getVisibleAdvisorNavSections(featureFlags, {
    enterpriseTeamEnabled,
    billingNavEnabled,
  });
  const activeHref = getActiveAdvisorNavHref(pathname, visibleSections, searchParams);
  const activeSectionId = getAdvisorNavSectionForHref(visibleSections, activeHref);

  const handleLockedClick = (_item: AdvisorNavItem, reason: AdvisorNavLockReason) => {
    if (reason) setNavLock(reason);
  };

  return (
    <TooltipProvider delayDuration={300}>
      <nav className={cn("flex-1 space-y-6 p-4", className)} aria-label="Advisor workspace">
        {visibleSections.map((section, sectionIndex) => {
          const sectionHasActive = section.items.some(
            (item) => item.href === activeHref
          );

          if (collapsibleSections) {
            return (
              <Collapsible
                key={section.id}
                defaultOpen={sectionHasActive || section.id === activeSectionId}
                className="space-y-1"
              >
                {sectionIndex > 0 && <Separator className="mb-4" />}
                <CollapsibleTrigger
                  className={cn(
                    "flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5",
                    "text-xs font-semibold uppercase tracking-wide text-muted-foreground",
                    "hover:bg-muted/40 hover:text-foreground transition-colors",
                    "[&[data-state=open]>svg]:rotate-180"
                  )}
                >
                  <span>{section.title}</span>
                  <ChevronDown className="size-3.5 shrink-0 transition-transform duration-200" />
                </CollapsibleTrigger>
                <CollapsibleContent className="pt-1">
                  <NavLinks
                    section={section}
                    activeHref={activeHref}
                    subscriptionTier={subscriptionTier}
                    clientLimitStatus={clientLimitStatus}
                    onLockedClick={handleLockedClick}
                    onNavigate={onNavigate}
                  />
                </CollapsibleContent>
              </Collapsible>
            );
          }

          return (
            <div key={section.id}>
              {sectionIndex > 0 && <Separator className="mb-4" />}
              <div className="space-y-1">
                <h3 className="px-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {section.title}
                </h3>
                <NavLinks
                  section={section}
                  activeHref={activeHref}
                  subscriptionTier={subscriptionTier}
                  clientLimitStatus={clientLimitStatus}
                  onLockedClick={handleLockedClick}
                  onNavigate={onNavigate}
                />
              </div>
            </div>
          );
        })}
      </nav>
      {navLock?.type === "tier" ? (
        <TierFeatureUpgradeDialog
          feature={navLock.feature}
          currentTier={subscriptionTier}
          open
          onOpenChange={(open) => {
            if (!open) setNavLock(null);
          }}
        />
      ) : null}
      {navLock?.type === "client-limit" && clientLimitStatus ? (
        <ClientLimitUpgradeDialog
          status={clientLimitStatus}
          open
          onOpenChange={(open) => {
            if (!open) setNavLock(null);
          }}
        />
      ) : null}
    </TooltipProvider>
  );
}

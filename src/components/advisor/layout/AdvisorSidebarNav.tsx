"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useState, type ReactNode } from "react";
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
  filterAdvisorNavSectionsWithAccessibleItems,
  partitionAdvisorNavSections,
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
  implementationTrackingEnabled?: boolean;
  collapsibleSections?: boolean;
  /** Mobile drawer: one scroll area for all sections (footer included). */
  unifiedScroll?: boolean;
  collapsed?: boolean;
  onNavigate?: () => void;
  className?: string;
}

function advisorNavItemClassName(
  isActive: boolean,
  options: { disabled?: boolean; locked?: boolean; collapsed?: boolean } = {},
) {
  const { disabled = false, locked = false, collapsed = false } = options;

  return cn(
    "flex w-full items-center rounded-md py-2 text-sm font-medium transition-colors",
    collapsed ? "justify-center px-2" : "gap-3 px-2",
    disabled
      ? "cursor-not-allowed text-muted-foreground/50"
      : locked
        ? "cursor-pointer text-muted-foreground hover:bg-muted/40 hover:text-foreground"
        : isActive
          ? "bg-primary/10 text-primary hover:bg-primary/15"
          : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
  );
}

function advisorSectionTitleClassName(isActiveSection: boolean) {
  return cn(
    "px-2 text-xs font-semibold tracking-wide transition-colors",
    isActiveSection ? "text-primary" : "text-muted-foreground",
  );
}

function NavItem({
  item,
  isActive,
  lockReason,
  onLockedClick,
  onNavigate,
  collapsed = false,
}: {
  item: AdvisorNavItem;
  isActive: boolean;
  lockReason: AdvisorNavLockReason;
  onLockedClick: () => void;
  onNavigate?: () => void;
  collapsed?: boolean;
}) {
  const Icon = item.icon;
  const isLocked = lockReason !== null;
  const baseClass = advisorNavItemClassName(isActive, {
    disabled: item.disabled,
    locked: isLocked,
    collapsed,
  });

  const label = collapsed ? null : <span className="truncate">{item.label}</span>;

  const wrapCollapsedTooltip = (node: ReactNode, tooltip: string) => {
    if (!collapsed) return node;
    return (
      <Tooltip>
        <TooltipTrigger asChild>{node}</TooltipTrigger>
        <TooltipContent side="right">{tooltip}</TooltipContent>
      </Tooltip>
    );
  };

  if (item.disabled) {
    const content = (
      <span className={baseClass} aria-disabled="true">
        <Icon className="size-4 shrink-0 opacity-60" aria-hidden />
        {label}
        <span className="sr-only">{item.label}</span>
      </span>
    );

    if (collapsed) {
      return wrapCollapsedTooltip(content, item.comingSoonTooltip ?? "Coming soon");
    }

    return (
      <Tooltip>
        <TooltipTrigger asChild>{content}</TooltipTrigger>
        <TooltipContent side="right">
          {item.comingSoonTooltip ?? "Coming soon"}
        </TooltipContent>
      </Tooltip>
    );
  }

  if (isLocked) {
    const content = (
      <button
        type="button"
        className={baseClass}
        onClick={onLockedClick}
        aria-label={`${item.label} — upgrade required`}
      >
        <Icon className="size-4 shrink-0 opacity-80" aria-hidden />
        {label}
        {!collapsed ? <TierFeatureLockIcon className="ml-auto !opacity-100" /> : null}
      </button>
    );

    return wrapCollapsedTooltip(content, `${item.label} — upgrade required`);
  }

  const content = (
    <Link
      href={item.href!}
      onClick={onNavigate}
      className={baseClass}
      aria-current={isActive ? "page" : undefined}
      aria-label={collapsed ? item.label : undefined}
    >
      <Icon className={cn("size-4 shrink-0", isActive && "text-primary")} aria-hidden />
      {label}
    </Link>
  );

  return wrapCollapsedTooltip(content, item.label);
}

function NavLinks({
  section,
  activeHref,
  subscriptionTier,
  clientLimitStatus,
  onLockedClick,
  onNavigate,
  collapsed = false,
}: {
  section: AdvisorNavSection;
  activeHref: string | undefined;
  subscriptionTier: SubscriptionTier;
  clientLimitStatus: ClientLimitSnapshot | null;
  onLockedClick: (item: AdvisorNavItem, reason: AdvisorNavLockReason) => void;
  onNavigate?: () => void;
  collapsed?: boolean;
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
            collapsed={collapsed}
          />
        );
      })}
    </div>
  );
}

function NavSectionGroup({
  sections,
  activeHref,
  activeSectionId,
  subscriptionTier,
  clientLimitStatus,
  onLockedClick,
  onNavigate,
  collapsed,
  collapsibleSections,
  startIndex = 0,
}: {
  sections: AdvisorNavSection[];
  activeHref: string | undefined;
  activeSectionId: string | undefined;
  subscriptionTier: SubscriptionTier;
  clientLimitStatus: ClientLimitSnapshot | null;
  onLockedClick: (item: AdvisorNavItem, reason: AdvisorNavLockReason) => void;
  onNavigate?: () => void;
  collapsed: boolean;
  collapsibleSections: boolean;
  startIndex?: number;
}) {
  return (
    <>
      {sections.map((section, index) => {
        const sectionIndex = startIndex + index;
        const sectionHasActive = section.items.some((item) => item.href === activeHref);
        const useCollapsible =
          collapsibleSections && section.placement !== "footer";

        if (useCollapsible) {
          return (
            <Collapsible
              key={section.id}
              defaultOpen={sectionHasActive || section.id === activeSectionId}
              className="space-y-1"
            >
              {sectionIndex > 0 && <Separator className="mb-4" />}
              <CollapsibleTrigger
                className={cn(
                  "flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 transition-colors",
                  advisorSectionTitleClassName(sectionHasActive),
                  "hover:bg-muted/40 hover:text-foreground",
                  "[&[data-state=open]>svg]:rotate-180",
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
                  onLockedClick={onLockedClick}
                  onNavigate={onNavigate}
                  collapsed={collapsed}
                />
              </CollapsibleContent>
            </Collapsible>
          );
        }

        return (
          <div key={section.id}>
            {sectionIndex > 0 && <Separator className={collapsed ? "mb-2" : "mb-4"} />}
            <div className="space-y-1">
              {!collapsed ? (
                <h3 className={advisorSectionTitleClassName(sectionHasActive)}>
                  {section.title}
                </h3>
              ) : null}
              <NavLinks
                section={section}
                activeHref={activeHref}
                subscriptionTier={subscriptionTier}
                clientLimitStatus={clientLimitStatus}
                onLockedClick={onLockedClick}
                onNavigate={onNavigate}
                collapsed={collapsed}
              />
            </div>
          </div>
        );
      })}
    </>
  );
}

export function AdvisorSidebarNav({
  featureFlags,
  subscriptionTier,
  clientLimitStatus,
  enterpriseTeamEnabled = false,
  billingNavEnabled = true,
  implementationTrackingEnabled = true,
  collapsibleSections = false,
  unifiedScroll = false,
  collapsed = false,
  onNavigate,
  className,
}: AdvisorSidebarNavProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [navLock, setNavLock] = useState<AdvisorNavLockReason>(null);
  const visibleSections = filterAdvisorNavSectionsWithAccessibleItems(
    getVisibleAdvisorNavSections(featureFlags, {
      enterpriseTeamEnabled,
      billingNavEnabled,
      implementationTrackingEnabled,
    }),
    subscriptionTier,
    clientLimitStatus,
  );
  const { primary, footer } = partitionAdvisorNavSections(visibleSections);
  const activeHref = getActiveAdvisorNavHref(pathname, visibleSections, searchParams);
  const activeSectionId = getAdvisorNavSectionForHref(visibleSections, activeHref);

  const handleLockedClick = (_item: AdvisorNavItem, reason: AdvisorNavLockReason) => {
    if (reason) setNavLock(reason);
  };

  const sectionGroupProps = {
    activeHref,
    activeSectionId,
    subscriptionTier,
    clientLimitStatus,
    onLockedClick: handleLockedClick,
    onNavigate,
    collapsed,
    collapsibleSections,
  };

  const footerBlock =
    footer.length > 0 ? (
      <NavSectionGroup
        sections={footer}
        startIndex={primary.length}
        {...sectionGroupProps}
      />
    ) : null;

  return (
    <TooltipProvider delayDuration={300}>
      <nav
        className={cn(
          "flex min-h-0 flex-1 flex-col",
          collapsed ? "p-2" : "p-4",
          !unifiedScroll && className,
        )}
        aria-label="Advisor workspace"
      >
        {unifiedScroll ? (
          <div className={cn("min-h-0 flex-1 space-y-6 overflow-y-auto", className)}>
            <NavSectionGroup sections={primary} startIndex={0} {...sectionGroupProps} />
            {footerBlock}
          </div>
        ) : (
          <>
            <div
              className={cn(
                "min-h-0 flex-1 space-y-6 overflow-y-auto",
                collapsed && "space-y-3",
              )}
            >
              <NavSectionGroup sections={primary} startIndex={0} {...sectionGroupProps} />
            </div>

            {footer.length > 0 ? (
              <div
                className={cn(
                  "shrink-0 space-y-6 border-t border-border/60 pt-4",
                  collapsed && "space-y-3 pt-3",
                )}
              >
                {footerBlock}
              </div>
            ) : null}
          </>
        )}
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

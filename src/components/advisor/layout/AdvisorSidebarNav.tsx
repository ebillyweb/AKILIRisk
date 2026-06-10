"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ChevronDown } from "lucide-react";
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
import {
  getActiveAdvisorNavHref,
  getAdvisorNavSectionForHref,
  getVisibleAdvisorNavSections,
  type AdvisorNavItem,
  type AdvisorNavSection,
} from "./advisor-nav";

interface AdvisorSidebarNavProps {
  featureFlags: AdvisorPlatformFeatureFlags;
  enterpriseTeamEnabled?: boolean;
  billingNavEnabled?: boolean;
  collapsibleSections?: boolean;
  onNavigate?: () => void;
  className?: string;
}

function NavItem({
  item,
  isActive,
  onNavigate,
}: {
  item: AdvisorNavItem;
  isActive: boolean;
  onNavigate?: () => void;
}) {
  const Icon = item.icon;
  const baseClass = cn(
    "flex w-full items-center gap-3 rounded-md px-2 py-2 text-sm font-medium transition-colors",
    item.disabled
      ? "cursor-not-allowed text-muted-foreground/50"
      : "hover:bg-muted/60 hover:text-foreground",
    !item.disabled && isActive ? "bg-muted text-foreground" : "text-muted-foreground"
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
  onNavigate,
}: {
  section: AdvisorNavSection;
  activeHref: string | undefined;
  onNavigate?: () => void;
}) {
  return (
    <div className="space-y-1">
      {section.items.map((item) => {
        const isActive = !item.disabled && item.href === activeHref;
        return (
          <NavItem
            key={`${section.id}-${item.label}`}
            item={item}
            isActive={isActive}
            onNavigate={onNavigate}
          />
        );
      })}
    </div>
  );
}

export function AdvisorSidebarNav({
  featureFlags,
  enterpriseTeamEnabled = false,
  billingNavEnabled = true,
  collapsibleSections = false,
  onNavigate,
  className,
}: AdvisorSidebarNavProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const visibleSections = getVisibleAdvisorNavSections(featureFlags, {
    enterpriseTeamEnabled,
    billingNavEnabled,
  });
  const activeHref = getActiveAdvisorNavHref(pathname, visibleSections, searchParams);
  const activeSectionId = getAdvisorNavSectionForHref(visibleSections, activeHref);

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
                  onNavigate={onNavigate}
                />
              </div>
            </div>
          );
        })}
      </nav>
    </TooltipProvider>
  );
}

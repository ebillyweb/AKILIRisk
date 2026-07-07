"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { ChevronDown, Eye } from "lucide-react";

import {
  getActiveAdminNavHref,
  getAdminNavSectionForHref,
  getVisibleAdminNavSections,
  type AdminNavSection,
} from "@/components/admin/layout/admin-nav";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface AdminSidebarNavProps {
  superUser: boolean;
  /** When true, nav sections collapse on small screens (mobile drawer). */
  collapsibleSections?: boolean;
  collapsed?: boolean;
  onNavigate?: () => void;
  className?: string;
}

function adminNavItemClassName(isActive: boolean, collapsed = false) {
  return cn(
    "flex items-center rounded-md py-2 text-sm font-medium transition-colors",
    collapsed ? "justify-center px-2" : "gap-3 px-2",
    isActive
      ? "bg-muted text-foreground"
      : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
  );
}

function NavLinks({
  section,
  activeHref,
  collapsed = false,
  onNavigate,
}: {
  section: AdminNavSection;
  activeHref: string | undefined;
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  const wrapCollapsedTooltip = (node: ReactNode, tooltip: string) => {
    if (!collapsed) return node;
    return (
      <Tooltip>
        <TooltipTrigger asChild>{node}</TooltipTrigger>
        <TooltipContent side="right">{tooltip}</TooltipContent>
      </Tooltip>
    );
  };

  return (
    <div className="space-y-1">
      {section.items.map((item) => {
        const isActive = activeHref === item.href;
        const Icon = item.icon;
        const label = collapsed ? null : <span className="truncate">{item.label}</span>;

        const content = (
          <Link
            href={item.href}
            onClick={onNavigate}
            className={adminNavItemClassName(isActive, collapsed)}
            aria-current={isActive ? "page" : undefined}
            aria-label={collapsed ? item.label : undefined}
          >
            <Icon className="size-4 shrink-0" />
            {label}
            {!collapsed && item.superAdminOnly ? (
              <Eye className="size-3 shrink-0 text-muted-foreground/60" />
            ) : null}
          </Link>
        );

        return (
          <div key={item.href}>
            {wrapCollapsedTooltip(content, item.label)}
          </div>
        );
      })}
    </div>
  );
}

export function AdminSidebarNav({
  superUser,
  collapsibleSections = false,
  collapsed = false,
  onNavigate,
  className,
}: AdminSidebarNavProps) {
  const pathname = usePathname();
  const visibleSections = getVisibleAdminNavSections(superUser);
  const activeHref = getActiveAdminNavHref(pathname, visibleSections);
  const activeSectionId = getAdminNavSectionForHref(visibleSections, activeHref);

  return (
    <TooltipProvider delayDuration={300}>
      <nav
        className={cn("flex-1", collapsed ? "space-y-3 p-2" : "space-y-6 p-4", className)}
        aria-label="Admin"
      >
        {visibleSections.map((section, sectionIndex) => {
          const sectionHasActive = section.items.some(
            (item) => item.href === activeHref,
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
                    collapsed={collapsed}
                    onNavigate={onNavigate}
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
                  <h3 className="px-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {section.title}
                  </h3>
                ) : null}
                <NavLinks
                  section={section}
                  activeHref={activeHref}
                  collapsed={collapsed}
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

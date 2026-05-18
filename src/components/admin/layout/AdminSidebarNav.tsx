"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, Eye } from "lucide-react";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  getActiveAdminNavHref,
  getAdminNavSectionForHref,
  getVisibleAdminNavSections,
  type AdminNavSection,
} from "./admin-nav";

interface AdminSidebarNavProps {
  superUser: boolean;
  /** When true, nav sections collapse on small screens (mobile drawer). */
  collapsibleSections?: boolean;
  onNavigate?: () => void;
  className?: string;
}

function NavLinks({
  section,
  activeHref,
  onNavigate,
}: {
  section: AdminNavSection;
  activeHref: string | undefined;
  onNavigate?: () => void;
}) {
  return (
    <div className="space-y-1">
      {section.items.map((item) => {
        const isActive = activeHref === item.href;
        const Icon = item.icon;

        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 rounded-md px-2 py-2 text-sm font-medium transition-colors",
              "hover:bg-muted/60 hover:text-foreground",
              isActive ? "bg-muted text-foreground" : "text-muted-foreground"
            )}
            aria-current={isActive ? "page" : undefined}
          >
            <Icon className="size-4 shrink-0" />
            <span className="truncate">{item.label}</span>
            {item.superAdminOnly && (
              <Eye className="size-3 shrink-0 text-muted-foreground/60" />
            )}
          </Link>
        );
      })}
    </div>
  );
}

export function AdminSidebarNav({
  superUser,
  collapsibleSections = false,
  onNavigate,
  className,
}: AdminSidebarNavProps) {
  const pathname = usePathname();
  const visibleSections = getVisibleAdminNavSections(superUser);
  const activeHref = getActiveAdminNavHref(pathname, visibleSections);
  const activeSectionId = getAdminNavSectionForHref(visibleSections, activeHref);

  return (
    <nav className={cn("flex-1 p-4 space-y-6", className)} aria-label="Admin">
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
  );
}

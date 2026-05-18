"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  Activity,
  BarChart3,
  ClipboardList,
  Database,
  FileText,
  Gauge,
  Home,
  Settings,
  Shield,
  TrendingUp,
  UserRound,
  Users,
  Zap,
  Eye,
  AlertTriangle,
  Puzzle,
  BookOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  superAdminOnly?: boolean;
};

type NavSection = {
  id: string;
  title: string;
  items: NavItem[];
};

const ADMIN_NAV_SECTIONS: NavSection[] = [
  {
    id: "overview",
    title: "Overview",
    items: [
      {
        href: "/admin",
        label: "Control Center",
        icon: Home,
      },
      {
        href: "/admin/analytics",
        label: "Executive Dashboard",
        icon: BarChart3,
      },
      {
        href: "/admin/operations",
        label: "Operations Health",
        icon: Gauge,
        superAdminOnly: true,
      },
    ],
  },
  {
    id: "assessments",
    title: "Assessments",
    items: [
      {
        href: "/admin/leads",
        label: "Assessment Requests",
        icon: ClipboardList,
      },
      {
        href: "/admin/assessment",
        label: "Active Assessments",
        icon: ClipboardList,
      },
      {
        href: "/admin/intake",
        label: "Intake Management",
        icon: ClipboardList,
      },
      {
        href: "/admin/intake/questions",
        label: "Intake Scripts",
        icon: FileText,
      },
      {
        href: "/admin/recommendations",
        label: "Recommendations",
        icon: BookOpen,
      },
    ],
  },
  {
    id: "people",
    title: "People",
    items: [
      {
        href: "/admin/advisors",
        label: "Advisors",
        icon: Users,
      },
      {
        href: "/admin/clients",
        label: "Clients",
        icon: UserRound,
      },
      {
        href: "/admin/staff",
        label: "Staff",
        icon: Users,
        superAdminOnly: true,
      },
    ],
  },
  {
    id: "intelligence",
    title: "Intelligence",
    items: [
      {
        href: "/admin/analytics",
        label: "Analytics",
        icon: TrendingUp,
      },
      {
        href: "/admin/risk-signals",
        label: "Risk Signals",
        icon: AlertTriangle,
        superAdminOnly: true,
      },
      {
        href: "/admin/reports",
        label: "Reports",
        icon: FileText,
      },
    ],
  },
  {
    id: "platform",
    title: "Platform",
    items: [
      {
        href: "/admin/integrations",
        label: "Integrations",
        icon: Puzzle,
        superAdminOnly: true,
      },
      {
        href: "/admin/question-bank",
        label: "Configuration",
        icon: Settings,
      },
      {
        href: "/admin/audit-log",
        label: "Audit Logs",
        icon: Activity,
      },
      {
        href: "/admin/settings",
        label: "Settings",
        icon: Settings,
      },
      {
        href: "/admin/scoring/thresholds",
        label: "Risk Thresholds",
        icon: Shield,
        superAdminOnly: true,
      },
      {
        href: "/admin/exports",
        label: "Data Exports",
        icon: Database,
        superAdminOnly: true,
      },
    ],
  },
];

interface AdminSidebarProps {
  superUser: boolean;
  className?: string;
}

export function AdminSidebar({ superUser, className }: AdminSidebarProps) {
  const pathname = usePathname();

  // Filter sections and items based on permissions
  const visibleSections = ADMIN_NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => superUser || !item.superAdminOnly),
  })).filter((section) => section.items.length > 0);

  // Find active item - most specific match wins
  const activeHref = visibleSections
    .flatMap((section) => section.items)
    .sort((a, b) => b.href.length - a.href.length)
    .find(({ href }) => pathname === href || pathname.startsWith(href + "/"))?.href;

  return (
    <aside className={cn("flex flex-col bg-card border-r border-border/60", className)}>
      {/* Sidebar Header */}
      <div className="p-6 border-b border-border/60">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Shield className="size-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-foreground">
              AKILI Control
            </h2>
            <p className="text-xs text-muted-foreground">Administration</p>
          </div>
        </div>
        {!superUser && (
          <Badge variant="secondary" className="mt-3 text-xs">
            Standard Admin
          </Badge>
        )}
        {superUser && (
          <Badge variant="default" className="mt-3 text-xs">
            Super Admin
          </Badge>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-6">
        {visibleSections.map((section, sectionIndex) => (
          <div key={section.id}>
            {sectionIndex > 0 && <Separator className="mb-4" />}
            <div className="space-y-1">
              <h3 className="px-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {section.title}
              </h3>
              <div className="space-y-1">
                {section.items.map((item) => {
                  const isActive = activeHref === item.href;
                  const Icon = item.icon;

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "flex items-center gap-3 rounded-md px-2 py-2 text-sm font-medium transition-colors",
                        "hover:bg-muted/60 hover:text-foreground",
                        isActive
                          ? "bg-muted text-foreground"
                          : "text-muted-foreground"
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
            </div>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-border/60">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Zap className="size-3" />
          <span>Platform Status: Operational</span>
        </div>
      </div>
    </aside>
  );
}
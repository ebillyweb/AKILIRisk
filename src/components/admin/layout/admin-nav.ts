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
  AlertTriangle,
  Puzzle,
  BookOpen,
} from "lucide-react";

export type AdminNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  superAdminOnly?: boolean;
};

export type AdminNavSection = {
  id: string;
  title: string;
  items: AdminNavItem[];
};

export const ADMIN_NAV_SECTIONS: AdminNavSection[] = [
  {
    id: "overview",
    title: "Overview",
    items: [
      { href: "/admin", label: "Control Center", icon: Home },
      { href: "/admin/analytics", label: "Executive Dashboard", icon: BarChart3 },
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
      { href: "/admin/leads", label: "Assessment Requests", icon: ClipboardList },
      { href: "/admin/assessment", label: "Active Assessments", icon: ClipboardList },
      { href: "/admin/intake", label: "Intake Management", icon: ClipboardList },
      { href: "/admin/intake/questions", label: "Intake Scripts", icon: FileText },
      { href: "/admin/recommendations", label: "Recommendations", icon: BookOpen },
    ],
  },
  {
    id: "people",
    title: "People",
    items: [
      { href: "/admin/advisors", label: "Advisors", icon: Users },
      { href: "/admin/clients", label: "Clients", icon: UserRound },
      { href: "/admin/staff", label: "Staff", icon: Users, superAdminOnly: true },
    ],
  },
  {
    id: "intelligence",
    title: "Intelligence",
    items: [
      { href: "/admin/analytics", label: "Analytics", icon: TrendingUp },
      {
        href: "/admin/risk-signals",
        label: "Risk Signals",
        icon: AlertTriangle,
        superAdminOnly: true,
      },
      { href: "/admin/reports", label: "Reports", icon: FileText },
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
      { href: "/admin/question-bank", label: "Configuration", icon: Settings },
      { href: "/admin/audit-log", label: "Audit Logs", icon: Activity },
      { href: "/admin/settings", label: "Settings", icon: Settings },
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

export function getVisibleAdminNavSections(superUser: boolean): AdminNavSection[] {
  return ADMIN_NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => superUser || !item.superAdminOnly),
  })).filter((section) => section.items.length > 0);
}

export function getActiveAdminNavHref(
  pathname: string,
  sections: AdminNavSection[]
): string | undefined {
  return sections
    .flatMap((section) => section.items)
    .sort((a, b) => b.href.length - a.href.length)
    .find(
      ({ href }) => pathname === href || pathname.startsWith(`${href}/`)
    )?.href;
}

export function getAdminNavSectionForHref(
  sections: AdminNavSection[],
  activeHref: string | undefined
): string | undefined {
  if (!activeHref) return sections[0]?.id;
  return sections.find((section) =>
    section.items.some((item) => item.href === activeHref)
  )?.id;
}

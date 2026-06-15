import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  Bell,
  Briefcase,
  ClipboardList,
  CreditCard,
  FileText,
  Home,
  ListTodo,
  Mail,
  MessageSquare,
  PlayCircle,
  Radio,
  Settings,
  Shield,
  Sparkles,
  UserPlus,
  Users,
} from "lucide-react";
import type { AdvisorPlatformFeatureFlags } from "@/lib/platform/feature-flags";

export const ADVISOR_COMING_SOON_TOOLTIP =
  "Coming soon — this workspace area is not available yet.";

export type AdvisorNavItem = {
  href?: string;
  label: string;
  icon: LucideIcon;
  disabled?: boolean;
  comingSoonTooltip?: string;
  /** When set, item is omitted unless the flag is true. */
  requiresFlag?: keyof AdvisorPlatformFeatureFlags;
  /** When true, item is shown only for enterprise OWNER/ADMIN team managers. */
  requiresEnterpriseTeam?: boolean;
  /** When true, item is shown only when the advisor can access billing (solo or enterprise OWNER/ADMIN). */
  requiresBillingAccess?: boolean;
};

export type AdvisorNavSection = {
  id: string;
  title: string;
  items: AdvisorNavItem[];
};

export const ADVISOR_NAV_SECTIONS: AdvisorNavSection[] = [
  {
    id: "overview",
    title: "Overview",
    items: [
      { href: "/advisor", label: "Today", icon: Home },
      {
        href: "/advisor/dashboard",
        label: "Risk Profile Portfolio",
        icon: BarChart3,
        requiresFlag: "governanceDashboardEnabled",
      },
    ],
  },
  {
    id: "clients",
    title: "Clients",
    items: [
      { href: "/advisor/pipeline", label: "All Clients", icon: Users },
      { href: "/advisor/invitations", label: "Invitations", icon: UserPlus },
    ],
  },
  {
    id: "intelligence",
    title: "Intelligence",
    items: [
      {
        href: "/advisor/intelligence",
        label: "Risk intelligence",
        icon: Shield,
        requiresFlag: "riskIntelligenceEnabled",
      },
      {
        href: "/advisor/recommendations",
        label: "Recommendations",
        icon: Sparkles,
        requiresFlag: "riskIntelligenceEnabled",
      },
      {
        href: "/advisor/reports",
        label: "Reports",
        icon: FileText,
        requiresFlag: "riskIntelligenceEnabled",
      },
      {
        href: "/advisor/signals",
        label: "Signals",
        icon: Radio,
        requiresFlag: "riskIntelligenceEnabled",
      },
    ],
  },
  {
    id: "workflows",
    title: "Workflow",
    items: [
      {
        href: "/advisor/pipeline?awaitingReview=1",
        label: "Intake",
        icon: ClipboardList,
      },
      {
        href: "/advisor/facilitate",
        label: "Risk Assessment",
        icon: PlayCircle,
      },
      {
        href: "/advisor/pipeline?documentsNeeded=1",
        label: "Document Requests",
        icon: Mail,
      },
      {
        href: "/advisor/pipeline?needsRescore=1",
        label: "Reassessment",
        icon: BarChart3,
      },
      { href: "/advisor/engagements", label: "Engagements", icon: Briefcase },
      {
        label: "Tasks",
        icon: ListTodo,
        disabled: true,
        comingSoonTooltip: ADVISOR_COMING_SOON_TOOLTIP,
        requiresFlag: "workflowTasksEnabled",
      },
      {
        label: "Follow-ups",
        icon: MessageSquare,
        disabled: true,
        comingSoonTooltip: ADVISOR_COMING_SOON_TOOLTIP,
        requiresFlag: "workflowFollowUpsEnabled",
      },
    ],
  },
  {
    id: "account",
    title: "Account",
    items: [
      { href: "/advisor/notifications", label: "Notifications", icon: Bell },
      { href: "/advisor/billing", label: "Billing", icon: CreditCard, requiresBillingAccess: true },
      {
        href: "/advisor/settings/team",
        label: "Team",
        icon: Users,
        requiresEnterpriseTeam: true,
      },
      { href: "/advisor/settings", label: "Settings", icon: Settings },
    ],
  },
];

export function getVisibleAdvisorNavSections(
  flags: AdvisorPlatformFeatureFlags,
  options?: { enterpriseTeamEnabled?: boolean; billingNavEnabled?: boolean }
): AdvisorNavSection[] {
  const enterpriseTeamEnabled = options?.enterpriseTeamEnabled === true;
  const billingNavEnabled = options?.billingNavEnabled !== false;
  return ADVISOR_NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => {
      if (item.requiresEnterpriseTeam && !enterpriseTeamEnabled) return false;
      if (item.requiresBillingAccess && !billingNavEnabled) return false;
      if (!item.requiresFlag) return true;
      return flags[item.requiresFlag];
    }),
  })).filter((section) => section.items.length > 0);
}

function hrefMatchesPath(pathname: string, path: string, hasQuery: boolean): boolean {
  if (hasQuery) {
    return pathname === path;
  }
  return pathname === path || pathname.startsWith(`${path}/`);
}

function hrefQueryMatches(
  query: string,
  searchParams?: Record<string, string | undefined> | URLSearchParams
): boolean {
  if (!searchParams) return false;
  const expected = new URLSearchParams(query);
  for (const [key, value] of expected.entries()) {
    const actual =
      searchParams instanceof URLSearchParams
        ? searchParams.get(key)
        : searchParams[key];
    if (actual !== value) return false;
  }
  return true;
}

export function getActiveAdvisorNavHref(
  pathname: string,
  sections: AdvisorNavSection[],
  searchParams?: Record<string, string | undefined> | URLSearchParams
): string | undefined {
  const items = sections
    .flatMap((section) => section.items)
    .filter((item): item is AdvisorNavItem & { href: string } =>
      Boolean(item.href && !item.disabled)
    )
    .sort((a, b) => b.href.length - a.href.length);

  for (const item of items) {
    const [path, query] = item.href.split("?");
    if (!hrefMatchesPath(pathname, path, Boolean(query))) continue;
    if (query && !hrefQueryMatches(query, searchParams)) continue;
    return item.href;
  }

  return undefined;
}

export function getAdvisorNavSectionForHref(
  sections: AdvisorNavSection[],
  activeHref: string | undefined
): string | undefined {
  if (!activeHref) return sections[0]?.id;
  return sections.find((section) =>
    section.items.some((item) => item.href === activeHref)
  )?.id;
}

import type { LucideIcon } from "lucide-react";
import type { SubscriptionTier } from "@prisma/client";
import {
  BarChart3,
  Bell,
  BookOpen,
  Briefcase,
  CalendarClock,
  ClipboardList,
  CreditCard,
  FileText,
  Home,
  Inbox,
  ListTodo,
  Mail,
  MessageSquare,
  PlayCircle,
  Radio,
  Settings,
  Shield,
  SlidersHorizontal,
  Sparkles,
  UserPlus,
  Users,
} from "lucide-react";
import type { AdvisorPlatformFeatureFlags } from "@/lib/platform/feature-flags";
import type { AdvisorTierFeatureKey } from "@/lib/billing/tier-features";
import { tierIncludesFeature } from "@/lib/billing/tier-features";
import type { ClientLimitSnapshot } from "@/lib/billing/client-limit";
import { REASSESSMENT_COPY, STALE_SCORES_COPY } from "@/lib/advisor/assessment-lifecycle-copy";

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
  /** Minimum module tier required; item stays visible but locked when tier is insufficient. */
  requiresTierFeature?: AdvisorTierFeatureKey;
  /** When true, item is locked if the advisor is at their active client cap. */
  requiresClientCapacity?: boolean;
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
        requiresTierFeature: "PORTFOLIO_ANALYTICS",
      },
    ],
  },
  {
    id: "clients",
    title: "Clients",
    items: [
      { href: "/advisor/pipeline", label: "All Clients", icon: Users },
      { href: "/advisor/leads", label: "Assessment leads", icon: Inbox },
      { href: "/advisor/invitations", label: "Invitations", icon: UserPlus, requiresClientCapacity: true },
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
        requiresTierFeature: "RISK_INTELLIGENCE",
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
        requiresTierFeature: "CONTINUOUS_MONITORING",
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
        href: "/advisor/pipeline?staleScores=1",
        label: STALE_SCORES_COPY.navLabel,
        icon: BarChart3,
      },
      {
        href: "/advisor/reassessment",
        label: REASSESSMENT_COPY.navCadenceLabel,
        icon: CalendarClock,
        requiresTierFeature: "REASSESSMENT_WORKFLOW",
      },
      {
        href: "/advisor/engagements",
        label: "Engagements",
        icon: Briefcase,
        requiresTierFeature: "IMPLEMENTATION_ENGAGEMENTS",
      },
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
    id: "configuration",
    title: "Configuration",
    items: [
      {
        href: "/advisor/methodology",
        label: "Methodology",
        icon: BookOpen,
        requiresTierFeature: "METHODOLOGY_CUSTOMIZATION",
      },
      { href: "/advisor/settings", label: "Settings", icon: Settings },
      {
        href: "/advisor/settings/notifications",
        label: "Notification preferences",
        icon: SlidersHorizontal,
      },
      {
        href: "/advisor/settings/team",
        label: "Team",
        icon: Users,
        requiresEnterpriseTeam: true,
      },
      {
        href: "/advisor/enterprise/methodology",
        label: "Firm methodology",
        icon: BookOpen,
        requiresEnterpriseTeam: true,
        requiresTierFeature: "METHODOLOGY_CUSTOMIZATION",
      },
    ],
  },
  {
    id: "account",
    title: "Account",
    items: [
      { href: "/advisor/notifications", label: "Notifications", icon: Bell },
      { href: "/advisor/billing", label: "Billing", icon: CreditCard, requiresBillingAccess: true },
    ],
  },
];

export function isAdvisorNavItemTierLocked(
  item: AdvisorNavItem,
  subscriptionTier: SubscriptionTier
): boolean {
  if (!item.requiresTierFeature) return false;
  return !tierIncludesFeature(subscriptionTier, item.requiresTierFeature);
}

export function isAdvisorNavItemClientLimitLocked(
  item: AdvisorNavItem,
  clientLimitStatus: ClientLimitSnapshot | null
): boolean {
  if (!item.requiresClientCapacity || !clientLimitStatus) return false;
  return !clientLimitStatus.canAddClient;
}

export type AdvisorNavLockReason =
  | { type: "tier"; feature: AdvisorTierFeatureKey }
  | { type: "client-limit" }
  | null;

export function getAdvisorNavItemLockReason(
  item: AdvisorNavItem,
  subscriptionTier: SubscriptionTier,
  clientLimitStatus: ClientLimitSnapshot | null
): AdvisorNavLockReason {
  if (isAdvisorNavItemTierLocked(item, subscriptionTier) && item.requiresTierFeature) {
    return { type: "tier", feature: item.requiresTierFeature };
  }
  if (isAdvisorNavItemClientLimitLocked(item, clientLimitStatus)) {
    return { type: "client-limit" };
  }
  return null;
}

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

/** Nested routes that should activate a specific sidebar item. */
const ADVISOR_NAV_PATH_ALIASES: ReadonlyArray<{
  test: (pathname: string) => boolean;
  pathname: string;
  searchParams?: Record<string, string>;
}> = [
  {
    test: (pathname) => pathname.startsWith("/advisor/clients/"),
    pathname: "/advisor/pipeline",
  },
  {
    test: (pathname) => pathname.startsWith("/advisor/review/"),
    pathname: "/advisor/pipeline",
    searchParams: { awaitingReview: "1" },
  },
  {
    test: (pathname) => pathname.startsWith("/advisor/analytics/"),
    pathname: "/advisor/dashboard",
  },
  {
    test: (pathname) =>
      pathname === "/advisor/engagement" || pathname.startsWith("/advisor/engagement/"),
    pathname: "/advisor/engagements",
  },
  {
    test: (pathname) => pathname.startsWith("/advisor/question-bank/"),
    pathname: "/advisor/methodology",
  },
  {
    test: (pathname) =>
      pathname === "/advisor/invite" || pathname.startsWith("/advisor/invite/"),
    pathname: "/advisor/invitations",
  },
  {
    test: (pathname) => pathname.startsWith("/advisor/enterprise/"),
    pathname: "/advisor/settings",
  },
];

function normalizeAdvisorNavLocation(
  pathname: string,
  searchParams?: Record<string, string | undefined> | URLSearchParams,
): {
  pathname: string;
  searchParams?: Record<string, string | undefined> | URLSearchParams;
} {
  for (const alias of ADVISOR_NAV_PATH_ALIASES) {
    if (!alias.test(pathname)) continue;
    return {
      pathname: alias.pathname,
      searchParams: alias.searchParams ?? searchParams,
    };
  }
  return { pathname, searchParams };
}

function hrefMatchesPath(pathname: string, path: string, hasQuery: boolean): boolean {
  if (hasQuery) {
    return pathname === path;
  }
  if (path === "/advisor") {
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
  const normalized = normalizeAdvisorNavLocation(pathname, searchParams);

  const items = sections
    .flatMap((section) => section.items)
    .filter((item): item is AdvisorNavItem & { href: string } =>
      Boolean(item.href && !item.disabled)
    )
    .sort((a, b) => b.href.length - a.href.length);

  for (const item of items) {
    const [path, query] = item.href.split("?");
    if (!hrefMatchesPath(normalized.pathname, path, Boolean(query))) continue;
    if (query && !hrefQueryMatches(query, normalized.searchParams)) continue;
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

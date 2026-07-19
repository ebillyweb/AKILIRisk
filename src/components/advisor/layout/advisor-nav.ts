import type { LucideIcon } from "lucide-react";
import type { SubscriptionTier } from "@prisma/client";
import {
  Bell,
  BookOpen,
  CreditCard,
  Home,
  Library,
  LifeBuoy,
  Palette,
  PlayCircle,
  ShieldCheck,
  UserPlus,
  Users,
} from "lucide-react";
import type { AdvisorPlatformFeatureFlags } from "@/lib/platform/feature-flags";
import type { AdvisorTierFeatureKey } from "@/lib/billing/tier-features";
import { tierIncludesFeature } from "@/lib/billing/tier-features";
import type { ClientLimitSnapshot } from "@/lib/billing/client-limit";
import type { EnterpriseAdvisorMemberVisibilityKey } from "@/lib/enterprise/advisor-member-visibility";

export type AdvisorNavItem = {
  href?: string;
  label: string;
  icon: LucideIcon;
  disabled?: boolean;
  comingSoonTooltip?: string;
  /** When set, item is omitted unless the flag is true. */
  requiresFlag?: keyof AdvisorPlatformFeatureFlags;
  /** When true, item is shown only when the advisor can access branding settings. */
  requiresBrandingNav?: boolean;
  /** When true, item is shown only for enterprise OWNER/ADMIN team managers. */
  requiresEnterpriseTeam?: boolean;
  /** When true, item is shown only when the advisor can access billing (solo or enterprise OWNER/ADMIN). */
  requiresBillingAccess?: boolean;
  /** When true, item is hidden for enterprise OWNER/ADMIN team managers. */
  hideForEnterpriseTeam?: boolean;
  /** When set, hidden for enterprise ADVISOR-role members when the firm toggle is off. */
  requiresMemberVisibility?: EnterpriseAdvisorMemberVisibilityKey;
  /** Minimum module tier required; item stays visible but locked when tier is insufficient. */
  requiresTierFeature?: AdvisorTierFeatureKey;
  /** When true, item is shown only when implementation tracking is enabled for the firm. */
  requiresImplementationTracking?: boolean;
  /** When true, item is locked if the advisor is at their active client cap. */
  requiresClientCapacity?: boolean;
};

export type AdvisorNavSection = {
  id: string;
  title: string;
  items: AdvisorNavItem[];
  /** Pin section to the bottom of the sidebar (above usage meter / alerts). */
  placement?: "footer";
};

export const ADVISOR_NAV_SECTIONS: AdvisorNavSection[] = [
  {
    id: "home",
    title: "Home",
    items: [
      { href: "/advisor", label: "Overview", icon: Home },
      {
        href: "/advisor/facilitate",
        label: "Sessions",
        icon: PlayCircle,
      },
      { href: "/advisor/notifications", label: "Notifications", icon: Bell },
    ],
  },
  {
    id: "clients",
    title: "Clients",
    items: [
      { href: "/advisor/pipeline", label: "Clients", icon: Users },
      {
        href: "/advisor/invitations",
        label: "Invitations",
        icon: UserPlus,
        requiresClientCapacity: true,
      },
    ],
  },
  {
    id: "firm",
    title: "Firm",
    items: [
      {
        href: "/advisor/settings/branding",
        label: "Brand",
        icon: Palette,
        requiresBrandingNav: true,
      },
      {
        href: "/advisor/settings/team",
        label: "Team",
        icon: Users,
        requiresEnterpriseTeam: true,
      },
      {
        href: "/advisor/settings/access-control",
        label: "Roles & Permissions",
        icon: ShieldCheck,
        requiresEnterpriseTeam: true,
      },
      {
        href: "/advisor/enterprise/methodology",
        label: "Practice Standards",
        icon: BookOpen,
        requiresEnterpriseTeam: true,
        requiresTierFeature: "METHODOLOGY_CUSTOMIZATION",
      },
      {
        href: "/advisor/billing",
        label: "Billing",
        icon: CreditCard,
        requiresBillingAccess: true,
      },
    ],
  },
  {
    id: "practice",
    title: "Practice",
    placement: "footer",
    items: [
      {
        href: "/advisor/methodology",
        label: "Your methodology",
        icon: BookOpen,
        requiresMemberVisibility: "methodology",
        requiresTierFeature: "METHODOLOGY_CUSTOMIZATION",
        hideForEnterpriseTeam: true,
      },
    ],
  },
  {
    id: "support",
    title: "Support",
    placement: "footer",
    items: [
      {
        href: "/support",
        label: "Support",
        icon: LifeBuoy,
      },
      {
        href: "/docs",
        label: "Docs",
        icon: Library,
      },
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

export function isAdvisorNavItemAccessible(
  item: AdvisorNavItem,
  subscriptionTier: SubscriptionTier,
  clientLimitStatus: ClientLimitSnapshot | null
): boolean {
  if (item.disabled) return false;
  return getAdvisorNavItemLockReason(item, subscriptionTier, clientLimitStatus) === null;
}

/** Omit sections where every visible item is tier- or client-limit locked. */
export function filterAdvisorNavSectionsWithAccessibleItems(
  sections: AdvisorNavSection[],
  subscriptionTier: SubscriptionTier,
  clientLimitStatus: ClientLimitSnapshot | null
): AdvisorNavSection[] {
  return sections.filter((section) =>
    section.items.some((item) =>
      isAdvisorNavItemAccessible(item, subscriptionTier, clientLimitStatus)
    )
  );
}

/** Remove tier-locked items (used when firm hides unavailable plan features for members). */
export function filterTierLockedAdvisorNavItems(
  sections: AdvisorNavSection[],
  subscriptionTier: SubscriptionTier,
): AdvisorNavSection[] {
  return sections
    .map((section) => ({
      ...section,
      items: section.items.filter(
        (item) => !isAdvisorNavItemTierLocked(item, subscriptionTier),
      ),
    }))
    .filter((section) => section.items.length > 0);
}

export function resolveAdvisorNavSectionsForDisplay(
  sections: AdvisorNavSection[],
  subscriptionTier: SubscriptionTier,
  clientLimitStatus: ClientLimitSnapshot | null,
  options?: { hideTierLockedItems?: boolean },
): AdvisorNavSection[] {
  const withTierPolicy = options?.hideTierLockedItems
    ? filterTierLockedAdvisorNavItems(sections, subscriptionTier)
    : sections;
  return filterAdvisorNavSectionsWithAccessibleItems(
    withTierPolicy,
    subscriptionTier,
    clientLimitStatus,
  );
}

export function getVisibleAdvisorNavSections(
  flags: AdvisorPlatformFeatureFlags,
  options?: {
    enterpriseTeamEnabled?: boolean;
    billingNavEnabled?: boolean;
    brandingNavEnabled?: boolean;
    implementationTrackingEnabled?: boolean;
    enterpriseMemberVisibility?: Partial<Record<EnterpriseAdvisorMemberVisibilityKey, boolean>>;
    applyEnterpriseMemberVisibility?: boolean;
  }
): AdvisorNavSection[] {
  const enterpriseTeamEnabled = options?.enterpriseTeamEnabled === true;
  const billingNavEnabled = options?.billingNavEnabled !== false;
  const brandingNavEnabled = options?.brandingNavEnabled === true;
  const implementationTrackingEnabled = options?.implementationTrackingEnabled !== false;
  const applyEnterpriseMemberVisibility = options?.applyEnterpriseMemberVisibility === true;
  const enterpriseMemberVisibility = options?.enterpriseMemberVisibility ?? {};
  return ADVISOR_NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => {
      if (item.requiresBrandingNav && !brandingNavEnabled) return false;
      if (item.requiresEnterpriseTeam && !enterpriseTeamEnabled) return false;
      if (item.hideForEnterpriseTeam && enterpriseTeamEnabled) return false;
      if (item.requiresBillingAccess && !billingNavEnabled) return false;
      if (item.requiresImplementationTracking && !implementationTrackingEnabled) return false;
      if (
        applyEnterpriseMemberVisibility &&
        item.requiresMemberVisibility &&
        enterpriseMemberVisibility[item.requiresMemberVisibility] === false
      ) {
        return false;
      }
      if (!item.requiresFlag) return true;
      return flags[item.requiresFlag];
    }),
  })).filter((section) => section.items.length > 0);
}

export function partitionAdvisorNavSections(sections: AdvisorNavSection[]): {
  primary: AdvisorNavSection[];
  footer: AdvisorNavSection[];
} {
  const primary: AdvisorNavSection[] = [];
  const footer: AdvisorNavSection[] = [];
  for (const section of sections) {
    if (section.placement === "footer") {
      footer.push(section);
    } else {
      primary.push(section);
    }
  }
  return { primary, footer };
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
    test: (pathname) => pathname.startsWith("/advisor/leads/"),
    pathname: "/advisor/leads",
  },
  {
    test: (pathname) => pathname.startsWith("/advisor/review/"),
    pathname: "/advisor/pipeline",
  },
  {
    test: (pathname) =>
      /^\/advisor\/pipeline\/[^/]+\/assessment\//.test(pathname),
    pathname: "/advisor/pipeline",
  },
  {
    test: (pathname) => pathname.startsWith("/advisor/analytics/"),
    pathname: "/advisor/dashboard",
  },
  {
    test: (pathname) => pathname.startsWith("/advisor/settings/notifications"),
    pathname: "/advisor/notifications",
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
    test: (pathname) =>
      pathname.startsWith("/advisor/enterprise/methodology") ||
      pathname.startsWith("/advisor/enterprise/recommendations"),
    pathname: "/advisor/enterprise/methodology",
  },
  {
    test: (pathname) => pathname.startsWith("/advisor/enterprise/"),
    pathname: "/advisor/settings/team",
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

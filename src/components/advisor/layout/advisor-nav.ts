import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  Bell,
  ClipboardList,
  CreditCard,
  FileText,
  GitBranch,
  Home,
  ListTodo,
  Mail,
  MessageSquare,
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
      { href: "/advisor/pipeline", label: "Pipeline", icon: GitBranch },
      {
        href: "/advisor/dashboard",
        label: "Governance portfolio",
        icon: BarChart3,
        requiresFlag: "governanceDashboardEnabled",
      },
    ],
  },
  {
    id: "clients",
    title: "Clients",
    items: [
      { href: "/advisor/pipeline", label: "Active clients", icon: Users },
      { href: "/advisor/invitations", label: "Invitations", icon: UserPlus },
      { href: "/advisor/pipeline", label: "Assessments", icon: ClipboardList },
      { href: "/advisor/pipeline", label: "Reviews needed", icon: FileText },
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
        label: "Recommendations",
        icon: Sparkles,
        disabled: true,
        comingSoonTooltip: ADVISOR_COMING_SOON_TOOLTIP,
      },
      {
        label: "Reports",
        icon: FileText,
        disabled: true,
        comingSoonTooltip: ADVISOR_COMING_SOON_TOOLTIP,
      },
      {
        label: "Signals",
        icon: Radio,
        disabled: true,
        comingSoonTooltip: ADVISOR_COMING_SOON_TOOLTIP,
      },
    ],
  },
  {
    id: "workflows",
    title: "Workflows",
    items: [
      { href: "/advisor/pipeline", label: "Intake", icon: ClipboardList },
      { href: "/advisor/pipeline", label: "Document requests", icon: Mail },
      {
        label: "Tasks",
        icon: ListTodo,
        disabled: true,
        comingSoonTooltip: ADVISOR_COMING_SOON_TOOLTIP,
      },
      {
        label: "Follow-ups",
        icon: MessageSquare,
        disabled: true,
        comingSoonTooltip: ADVISOR_COMING_SOON_TOOLTIP,
      },
    ],
  },
  {
    id: "account",
    title: "Account",
    items: [
      { href: "/advisor/notifications", label: "Notifications", icon: Bell },
      { href: "/advisor/billing", label: "Billing", icon: CreditCard },
      { href: "/advisor/settings", label: "Settings", icon: Settings },
    ],
  },
];

export function getVisibleAdvisorNavSections(
  flags: AdvisorPlatformFeatureFlags
): AdvisorNavSection[] {
  return ADVISOR_NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => {
      if (!item.requiresFlag) return true;
      return flags[item.requiresFlag];
    }),
  })).filter((section) => section.items.length > 0);
}

export function getActiveAdvisorNavHref(
  pathname: string,
  sections: AdvisorNavSection[]
): string | undefined {
  const hrefs = sections
    .flatMap((section) => section.items)
    .map((item) => item.href)
    .filter((href): href is string => Boolean(href))
    .sort((a, b) => b.length - a.length);

  return hrefs.find(
    (href) => pathname === href || pathname.startsWith(`${href}/`)
  );
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

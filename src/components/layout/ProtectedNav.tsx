"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  type PreviewBrandHex,
  isPreviewHexDark,
} from "@/lib/branding/preview-hex";
import type { AdvisorPlatformFeatureFlags } from "@/lib/platform/feature-flags";

const CLIENT_NAV_ITEMS: { href: string; label: string }[] = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/intake", label: "Intake" },
  { href: "/assessment", label: "Assessment" },
  { href: "/documents", label: "Documents" },
  { href: "/profiles", label: "Profiles & Roles" },
  { href: "/settings", label: "Settings" },
];

const ADVISOR_NAV_ITEMS: { href: string; label: string }[] = [
  { href: "/advisor", label: "Subscriber hub" },
  { href: "/advisor/invitations", label: "Invitations" },
  { href: "/advisor/dashboard", label: "Dashboard" },
  { href: "/advisor/intelligence", label: "Risk Intelligence" },
  { href: "/advisor/notifications", label: "Notifications" },
  { href: "/advisor/billing", label: "Billing" },
  { href: "/advisor/settings", label: "Settings" },
];

const ADMIN_NAV_ITEMS: { href: string; label: string }[] = [
  { href: "/admin", label: "Admin" },
  // §9.1 (BRD): AKILI-side aggregate analytics. Slotted between
  // /admin (home/index) and /admin/advisors so it sits visually next to
  // the per-tenant drill-down surfaces it links into.
  { href: "/admin/analytics", label: "Analytics Dashboard" },
  // Operational health: separate from analytics so platform/system
  // signals never share a page with business metrics.
  { href: "/admin/operations", label: "Operations Dashboard" },
  { href: "/admin/advisors", label: "Advisors" },
  { href: "/admin/clients", label: "Clients" },
  { href: "/admin/staff", label: "Staff" },
  { href: "/admin/leads", label: "Assessment requests" },
  { href: "/admin/intake", label: "Intake Management" },
  { href: "/admin/intake/questions", label: "Intake script" },
  { href: "/admin/assessment", label: "Assessment Management" },
  { href: "/admin/settings", label: "Settings" },
];

interface ProtectedNavProps {
  showAdvisor?: boolean;
  showAdmin?: boolean;
  restrictNavToIntake?: boolean;
  /** When false for clients, Assessment link is disabled until advisor approves intake or waives it */
  assessmentUnlockedForClient?: boolean;
  /** Hide client-only Profiles & Roles link when feature is unavailable. */
  hideProfilesNav?: boolean;
  /** Client portal + assigned advisor: match `BrandingPreview` nav (primary text, light active pill) */
  clientBrandHex?: PreviewBrandHex | null;
  /** When omitted for advisors, both features are shown (backward compatible). */
  advisorFeatureFlags?: AdvisorPlatformFeatureFlags | null;
}

export function ProtectedNav({
  showAdvisor = false,
  showAdmin = false,
  restrictNavToIntake = false,
  assessmentUnlockedForClient = false,
  hideProfilesNav = false,
  clientBrandHex = null,
  advisorFeatureFlags = null,
}: ProtectedNavProps) {
  const pathname = usePathname();

  // Hide admin nav when in admin area - sidebar handles navigation
  if (showAdmin && pathname.startsWith("/admin")) {
    return null;
  }

  const advisorNavItems: typeof ADVISOR_NAV_ITEMS | undefined = showAdvisor
    ? advisorFeatureFlags
      ? ADVISOR_NAV_ITEMS.filter((item) => {
          if (item.href === "/advisor/dashboard") {
            return advisorFeatureFlags.governanceDashboardEnabled;
          }
          if (item.href === "/advisor/intelligence") {
            return advisorFeatureFlags.riskIntelligenceEnabled;
          }
          return true;
        })
      : ADVISOR_NAV_ITEMS
    : undefined;

  const baseItems = showAdmin
    ? ADMIN_NAV_ITEMS
    : advisorNavItems !== undefined
      ? advisorNavItems
      : CLIENT_NAV_ITEMS;
  const items =
    hideProfilesNav && !showAdvisor && !showAdmin
      ? baseItems.filter((item) => item.href !== "/profiles")
      : baseItems;

  // When restrictNavToIntake (client, intake not submitted), only Intake is enabled
  const isClientRestricted = restrictNavToIntake && !showAdvisor && !showAdmin;
  const enabledHrefs = isClientRestricted ? new Set(["/intake"]) : null;

  // For clients with submitted but not approved intake: Assessment is disabled
  const isClientAssessmentLocked =
    !showAdvisor && !showAdmin && !assessmentUnlockedForClient;
  const disabledAssessmentHref = isClientAssessmentLocked
    ? "/assessment"
    : null;

  // Most specific matching route wins (e.g. /advisor/dashboard over /advisor)
  const activeHref = [...items]
    .sort((a, b) => b.href.length - a.href.length)
    .find(
      ({ href }) => pathname === href || pathname.startsWith(href + "/"),
    )?.href;

  const clientPreviewNav =
    !!clientBrandHex && !showAdvisor && !showAdmin;

  return (
    <nav
      className="flex min-w-0 flex-1 flex-wrap items-center gap-2"
      aria-label="Main navigation"
    >
      {items.map(({ href, label }) => {
        const isActive = activeHref === href;
        const isDisabledByIntake =
          enabledHrefs !== null && !enabledHrefs.has(href);
        const isDisabledByApproval = disabledAssessmentHref === href;
        const isDisabled = isDisabledByIntake || isDisabledByApproval;
        const disabledTitle = isDisabledByApproval
          ? "Assessment unlocks after your advisor reviews and approves your intake."
          : "Complete your intake interview to unlock. Assessment and other areas become available after your advisor reviews and assigns your assessment.";
        return isDisabled ? (
          <span
            key={href}
            aria-disabled="true"
            title={disabledTitle}
            className={cn(
              "inline-flex h-9 shrink-0 cursor-not-allowed items-center rounded-md px-3 text-sm font-medium",
              !clientPreviewNav && "text-muted-foreground/60 opacity-70",
            )}
            style={
              clientPreviewNav
                ? {
                    color: isPreviewHexDark(clientBrandHex!.secondary)
                      ? "rgba(255, 255, 255, 0.72)"
                      : clientBrandHex!.primary,
                    opacity: isPreviewHexDark(clientBrandHex!.secondary)
                      ? 1
                      : 0.5,
                  }
                : undefined
            }
          >
            {label}
          </span>
        ) : clientPreviewNav ? (
          <Link
            key={href}
            href={href}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "inline-flex h-9 shrink-0 items-center rounded-md px-3 text-sm font-medium transition-colors",
              "hover:bg-white/50",
            )}
            style={{
              color: clientBrandHex!.primary,
              ...(isActive
                ? {
                    backgroundColor: "rgba(255, 255, 255, 0.55)",
                    fontWeight: 600,
                  }
                : {}),
            }}
          >
            {label}
          </Link>
        ) : (
          <Button
            asChild
            variant="ghost"
            size="sm"
            className={cn(
              "h-9 shrink-0 px-3",
              isActive &&
                "bg-secondary text-foreground font-semibold hover:bg-secondary hover:text-foreground",
            )}
            key={href}
          >
            <Link href={href} aria-current={isActive ? "page" : undefined}>
              {label}
            </Link>
          </Button>
        );
      })}
    </nav>
  );
}

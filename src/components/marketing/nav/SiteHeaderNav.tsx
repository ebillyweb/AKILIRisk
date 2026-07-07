"use client";

import type { HeroAudience } from "@/components/home/hero/hero-audience-content";
import {
  MarketingNavLink,
  NavActiveIndicator,
  navLinkActiveClassName,
  marketingNavLinkClassName,
} from "@/components/marketing/MarketingNavLink";
import {
  audienceNavHref,
  SITE_AUDIENCE_NAV,
  SITE_PRIMARY_NAV_LINKS,
} from "@/lib/marketing/site-nav";
import { cn } from "@/lib/utils";

type SiteHeaderNavProps = {
  pathname: string;
  isHomepage: boolean;
  activeAudience?: HeroAudience;
  onAudienceChange?: (audience: HeroAudience) => void;
};

function AudienceNavItem({
  id,
  label,
  testId,
  isHomepage,
  isActive,
  onAudienceChange,
}: {
  id: HeroAudience;
  label: string;
  testId: string;
  isHomepage: boolean;
  isActive: boolean;
  onAudienceChange?: (audience: HeroAudience) => void;
}) {
  if (isHomepage && onAudienceChange) {
    return (
      <button
        type="button"
        role="tab"
        id={`site-nav-tab-${id}`}
        aria-selected={isActive}
        aria-controls="landing-hero-panel"
        tabIndex={isActive ? 0 : -1}
        data-testid={testId}
        onClick={() => onAudienceChange(id)}
        className={cn(
          marketingNavLinkClassName,
          isActive && navLinkActiveClassName,
        )}
      >
        {label}
        {isActive ? <NavActiveIndicator /> : null}
      </button>
    );
  }

  return (
    <MarketingNavLink href={audienceNavHref(id)} data-testid={testId}>
      {label}
    </MarketingNavLink>
  );
}

export function SiteHeaderNav({
  pathname,
  isHomepage,
  activeAudience,
  onAudienceChange,
}: SiteHeaderNavProps) {
  return (
    <nav
      className="hidden min-w-0 flex-1 items-center justify-center gap-0.5 lg:flex"
      aria-label="Main navigation"
    >
      <div
        className="flex items-center gap-0.5"
        role={isHomepage ? "tablist" : undefined}
        aria-label={isHomepage ? "Choose your path" : undefined}
      >
        {SITE_AUDIENCE_NAV.map(({ id, label, testId }) => (
          <AudienceNavItem
            key={id}
            id={id}
            label={label}
            testId={testId}
            isHomepage={isHomepage}
            isActive={isHomepage && activeAudience === id}
            onAudienceChange={onAudienceChange}
          />
        ))}
      </div>

      <span className="mx-2 h-4 w-px bg-border/50" aria-hidden />

      {SITE_PRIMARY_NAV_LINKS.map(({ href, label }) => {
        const isActive = pathname === href;
        return (
          <MarketingNavLink
            key={href}
            href={href}
            isActive={isActive}
            aria-current={isActive ? "page" : undefined}
          >
            {label}
          </MarketingNavLink>
        );
      })}
    </nav>
  );
}

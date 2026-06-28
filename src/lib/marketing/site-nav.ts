import type { HeroAudience } from "@/components/home/hero/hero-audience-content";

export const SITE_AUDIENCE_NAV: ReadonlyArray<{
  id: HeroAudience;
  label: string;
  testId: string;
}> = [
  { id: "families", label: "Families", testId: "site-nav-audience-families" },
  { id: "advisors", label: "Firms", testId: "site-nav-audience-advisors" },
  { id: "overview", label: "How It Works", testId: "site-nav-audience-overview" },
] as const;

export const SITE_PRIMARY_NAV_LINKS = [
  { href: "/pricing", label: "Pricing" },
  { href: "/about", label: "About" },
] as const;

export const SITE_SECONDARY_NAV_LINKS = [
  { href: "/contact", label: "Contact" },
] as const;

/** @deprecated Use SITE_PRIMARY_NAV_LINKS — kept for any legacy imports during migration. */
export const SITE_NAV_LINKS = [
  ...SITE_AUDIENCE_NAV.map(({ id, label }) => ({
    href: id === "overview" ? "/?audience=overview" : `/?audience=${id}`,
    label,
  })),
  { href: "/pricing", label: "Pricing" },
  { href: "/about", label: "About" },
] as const;

export function audienceNavHref(audience: HeroAudience): string {
  return `/?audience=${audience}`;
}

import type { HeroAudience } from "@/components/home/hero/hero-audience-content";
import type { ContactFormIntent } from "@/lib/marketing/contact-form-intent";
import type { SignInRole } from "@/lib/auth/sign-in-roles";

/** Human-readable marketing paths for homepage audience tabs. */
export const HERO_AUDIENCE_PATHS: Record<HeroAudience, string> = {
  families: "/families",
  advisors: "/firms",
  overview: "/how-it-works",
};

export const HERO_AUDIENCE_LANDING_PATHS = Object.values(
  HERO_AUDIENCE_PATHS,
) as ReadonlyArray<(typeof HERO_AUDIENCE_PATHS)[HeroAudience]>;

export const CONTACT_INTENT_PATHS: Record<ContactFormIntent, string> = {
  demo: "/contact/demo",
  enterprise: "/contact/enterprise",
};

export const SIGN_IN_ROLE_PATHS: Record<"client" | "advisor", string> = {
  client: "/signin/client",
  advisor: "/signin/advisor",
};

const HERO_PATH_TO_AUDIENCE = Object.fromEntries(
  Object.entries(HERO_AUDIENCE_PATHS).map(([audience, path]) => [
    path,
    audience as HeroAudience,
  ]),
) as Record<string, HeroAudience>;

export function heroAudiencePath(audience: HeroAudience): string {
  return HERO_AUDIENCE_PATHS[audience];
}

export function parseHeroAudiencePath(
  pathname: string | null | undefined,
): HeroAudience | null {
  if (!pathname) return null;
  const normalized =
    pathname.length > 1 && pathname.endsWith("/")
      ? pathname.slice(0, -1)
      : pathname;
  return HERO_PATH_TO_AUDIENCE[normalized] ?? null;
}

export function isHeroAudienceLandingPath(pathname: string): boolean {
  return parseHeroAudiencePath(pathname) !== null;
}

export function isMarketingHomePath(pathname: string): boolean {
  return pathname === "/" || isHeroAudienceLandingPath(pathname);
}

export function contactIntentPath(intent: ContactFormIntent): string {
  return CONTACT_INTENT_PATHS[intent];
}

export function parseContactIntentPath(
  pathname: string | null | undefined,
): ContactFormIntent | null {
  if (!pathname) return null;
  const normalized =
    pathname.length > 1 && pathname.endsWith("/")
      ? pathname.slice(0, -1)
      : pathname;
  if (normalized === CONTACT_INTENT_PATHS.demo) return "demo";
  if (normalized === CONTACT_INTENT_PATHS.enterprise) return "enterprise";
  return null;
}

export function signInRolePath(role: Extract<SignInRole, "client" | "advisor">): string {
  return SIGN_IN_ROLE_PATHS[role];
}

export function parseSignInRolePath(
  pathname: string | null | undefined,
): Extract<SignInRole, "client" | "advisor"> | null {
  if (!pathname) return null;
  const normalized =
    pathname.length > 1 && pathname.endsWith("/")
      ? pathname.slice(0, -1)
      : pathname;
  if (normalized === SIGN_IN_ROLE_PATHS.client) return "client";
  if (normalized === SIGN_IN_ROLE_PATHS.advisor) return "advisor";
  return null;
}

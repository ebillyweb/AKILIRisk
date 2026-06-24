"use client";

import Link from "next/link";

type ClientPortalBrandedHeaderMarkProps = {
  brandTitle: string;
  /** HTTPS URL or same-origin proxy path (e.g. /api/client/advisor-logo) */
  logoSrc: string | null;
  /** Match advisor branding preview: primary hex for title (and link) */
  primaryHex?: string;
  homeHref?: string;
  /** Use h1 on public landing pages for SEO/accessibility */
  titleAsHeading?: boolean;
};

/**
 * Client portal header mark: optional logo + advisor brand title (replaces Akili lockup when assigned advisor has branding).
 */
export function ClientPortalBrandedHeaderMark({
  brandTitle,
  logoSrc,
  primaryHex,
  homeHref = "/dashboard",
  titleAsHeading = false,
}: ClientPortalBrandedHeaderMarkProps) {
  const TitleTag = titleAsHeading ? "h1" : "span";

  return (
    <Link
      href={homeHref}
      className="block text-foreground"
      aria-label={`${brandTitle} home`}
      style={primaryHex ? { color: primaryHex } : undefined}
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
        {logoSrc ? (
          <img
            src={logoSrc}
            alt=""
            className="h-10 w-auto max-w-[200px] object-contain object-left"
            onError={(e) => {
              e.currentTarget.style.display = "none";
            }}
          />
        ) : null}
        <TitleTag
          className="text-lg font-semibold tracking-tight sm:text-xl"
          style={primaryHex ? { color: primaryHex } : undefined}
        >
          {brandTitle}
        </TitleTag>
      </div>
    </Link>
  );
}

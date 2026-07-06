"use client";

import { ClientPortalBrandedHeaderMark } from "@/components/layout/ClientPortalBrandedHeaderMark";
import { BrandedPortalMobileNav } from "@/components/branding/BrandedPortalMobileNav";
import { BrandedPortalNavAuthActions } from "@/components/branding/BrandedPortalNavAuthActions";
import { brandedPortalLogoImgSrc } from "@/lib/branding/branded-portal-logo";
import { clientPortalBrandingDisplayTitle } from "@/lib/client/client-portal-branding";
import { getPreviewBrandHex } from "@/lib/branding/preview-hex";
import type { AdvisorBrandingData } from "@/lib/validation/branding";
import { cn } from "@/lib/utils";

type BrandedPortalHeaderProps = {
  branding: AdvisorBrandingData;
  homeHref?: string;
  titleAsHeading?: boolean;
  className?: string;
  /** Settings preview: same-origin logo proxy path */
  logoSrcOverride?: string | null;
};

export function BrandedPortalHeader({
  branding,
  homeHref = "/",
  titleAsHeading = false,
  className,
  logoSrcOverride,
}: BrandedPortalHeaderProps) {
  const brandTitle = clientPortalBrandingDisplayTitle(branding);
  const logoSrc = logoSrcOverride ?? brandedPortalLogoImgSrc(branding);
  const previewHex = getPreviewBrandHex(branding);

  return (
    <header
      className={cn(
        "site-header sticky top-0 z-40 -mx-4 px-4 py-3 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8",
        className,
      )}
    >
      <div
        className="flex items-center justify-between gap-4 rounded-[1.25rem] border border-border/60 bg-card/75 px-4 py-3 shadow-[0_12px_40px_-28px_rgba(26,24,20,0.35)] backdrop-blur-xl sm:px-5"
        style={
          previewHex
            ? {
                borderColor: `${previewHex.primary}22`,
              }
            : undefined
        }
      >
        <div className="min-w-0 space-y-1">
          <ClientPortalBrandedHeaderMark
            brandTitle={brandTitle}
            logoSrc={logoSrc}
            primaryHex={previewHex?.primary}
            homeHref={homeHref}
            titleAsHeading={titleAsHeading}
          />
          <p
            className="editorial-kicker !text-[0.65rem] !tracking-[0.12em]"
            style={previewHex ? { color: previewHex.primary, opacity: 0.78 } : undefined}
          >
            Brought to you by AKILI Risk Intelligence
          </p>
        </div>

        <nav
          className="hidden items-center gap-2 lg:flex"
          aria-label="Portal navigation"
        >
          <BrandedPortalNavAuthActions />
        </nav>

        <BrandedPortalMobileNav primaryHex={previewHex?.primary} />
      </div>
    </header>
  );
}

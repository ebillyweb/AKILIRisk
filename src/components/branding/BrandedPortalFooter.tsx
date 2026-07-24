import Link from "next/link";
import { Mail, Phone, Globe } from "lucide-react";
import { AkiliIcon } from "@/components/home/AkiliLogoLockup";
import { MarketingSurfaceCard } from "@/components/marketing/MarketingSurfaceCard";
import { clientPortalBrandingDisplayTitle } from "@/lib/client/client-portal-branding";
import { buildTenantScopedPublicPath } from "@/lib/advisor/tenant-path-portals";
import type { AdvisorBrandingData } from "@/lib/validation/branding";
import { cn } from "@/lib/utils";

type BrandedPortalFooterProps = {
  branding: AdvisorBrandingData;
  className?: string;
  tenantPathPrefix?: string | null;
};

export function BrandedPortalFooter({
  branding,
  className,
  tenantPathPrefix = null,
}: BrandedPortalFooterProps) {
  const brandTitle = clientPortalBrandingDisplayTitle(branding);
  const year = new Date().getFullYear();
  const hasContact = Boolean(
    branding.supportEmail || branding.supportPhone || branding.websiteUrl,
  );

  return (
    <footer
      className={cn(
        "mt-4 border-t border-border/70 pt-10 text-sm text-muted-foreground",
        className,
      )}
    >
      <div className="grid gap-8 lg:grid-cols-[1.2fr_1fr]">
        <div className="space-y-4">
          <p className="font-display text-lg font-semibold text-foreground">{brandTitle}</p>
          {branding.emailFooterText ? (
            <p className="max-w-md text-sm leading-6">{branding.emailFooterText}</p>
          ) : (
            <p className="max-w-md text-sm leading-6">
              Comprehensive risk assessment and governance insights, delivered with care.
            </p>
          )}
          <div className="flex items-center gap-2 pt-1">
            <AkiliIcon size={24} className="opacity-75" />
            <span className="text-xs leading-5 text-muted-foreground">
              Powered by AkiliRisk Platform
            </span>
          </div>
        </div>

        {hasContact ? (
          <MarketingSurfaceCard className="space-y-4">
            <p className="editorial-kicker">Advisor contact</p>
            <div className="flex flex-col gap-3">
              {branding.supportEmail ? (
                <a
                  href={`mailto:${branding.supportEmail}`}
                  className="inline-flex items-center gap-2 font-medium text-foreground hover:underline"
                >
                  <Mail className="size-4 shrink-0 text-brand" aria-hidden />
                  {branding.supportEmail}
                </a>
              ) : null}
              {branding.supportPhone ? (
                <a
                  href={`tel:${branding.supportPhone}`}
                  className="inline-flex items-center gap-2 font-medium text-foreground hover:underline"
                >
                  <Phone className="size-4 shrink-0 text-brand" aria-hidden />
                  {branding.supportPhone}
                </a>
              ) : null}
              {branding.websiteUrl ? (
                <a
                  href={branding.websiteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 font-medium text-foreground hover:underline"
                >
                  <Globe className="size-4 shrink-0 text-brand" aria-hidden />
                  Visit website
                </a>
              ) : null}
            </div>
          </MarketingSurfaceCard>
        ) : null}
      </div>

      <div className="mt-8 flex flex-col gap-3 border-t border-border/60 pt-6 text-center sm:flex-row sm:items-center sm:justify-between sm:text-left">
        <p>
          &copy; {year} {brandTitle}. All rights reserved.
        </p>
        <nav
          className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 sm:justify-end"
          aria-label="Portal footer links"
        >
          <Link
            href={buildTenantScopedPublicPath("/signin", tenantPathPrefix)}
            className="font-medium text-foreground/90 underline-offset-4 hover:text-foreground hover:underline"
          >
            Sign in
          </Link>
          <Link
            href={buildTenantScopedPublicPath("/privacy", tenantPathPrefix)}
            className="font-medium text-foreground/90 underline-offset-4 hover:text-foreground hover:underline"
          >
            Privacy Policy
          </Link>
          <Link
            href={buildTenantScopedPublicPath("/terms", tenantPathPrefix)}
            className="font-medium text-foreground/90 underline-offset-4 hover:text-foreground hover:underline"
          >
            Terms of Service
          </Link>
        </nav>
      </div>
    </footer>
  );
}

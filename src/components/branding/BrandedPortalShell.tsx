import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ClientPortalBrandedHeaderMark } from "@/components/layout/ClientPortalBrandedHeaderMark";
import { BrandedPortalFooter } from "@/components/branding/BrandedPortalFooter";
import {
  clientPortalBrandingDisplayTitle,
  clientPortalLogoImgSrc,
} from "@/lib/client/client-portal-branding";
import { getPreviewBrandHex } from "@/lib/branding/preview-hex";
import { Button } from "@/components/ui/button";
import type { AdvisorBrandingData } from "@/lib/validation/branding";
import { cn } from "@/lib/utils";

type BrandedPortalShellProps = {
  branding: AdvisorBrandingData;
  homeHref?: string;
  children: React.ReactNode;
  /** Wider landing layout vs. centered auth forms */
  variant?: "auth" | "landing";
  /** Use h1 for brand title on the tenant landing page only */
  titleAsHeading?: boolean;
};

/**
 * Shared white-label shell for tenant landing and auth routes.
 * Header nav and footer are always shown so public pages stay consistent.
 */
export function BrandedPortalShell({
  branding,
  homeHref = "/",
  children,
  variant = "auth",
  titleAsHeading = false,
}: BrandedPortalShellProps) {
  const brandTitle = clientPortalBrandingDisplayTitle(branding);
  const logoSrc = clientPortalLogoImgSrc(branding);
  const previewHex = getPreviewBrandHex(branding);

  return (
    <div
      className={cn("min-h-screen py-6 sm:py-8", previewHex && "branded-portal-shell")}
      style={
        previewHex
          ? ({
              "--branded-portal-shell-bg": previewHex.secondary,
              "--client-brand-primary": previewHex.primary,
            } as React.CSSProperties)
          : undefined
      }
    >
      <div className="page-shell">
        <div
          className="hero-surface overflow-hidden rounded-[2rem] px-4 py-6 sm:px-8 sm:py-10"
          style={
            previewHex
              ? {
                  borderColor: `${previewHex.primary}22`,
                }
              : undefined
          }
        >
          <header className="mb-8 flex flex-col gap-4 border-b border-border/60 pb-6 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-2">
              <ClientPortalBrandedHeaderMark
                brandTitle={brandTitle}
                logoSrc={logoSrc}
                primaryHex={previewHex?.primary}
                homeHref={homeHref}
                titleAsHeading={titleAsHeading}
              />
              <p
                className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
                style={previewHex ? { color: previewHex.primary, opacity: 0.72 } : undefined}
              >
                Brought to you by AKILI Risk Intelligence
              </p>
            </div>

            <nav
              className="flex flex-wrap items-center gap-2 sm:justify-end"
              aria-label="Portal"
            >
              <Button variant="ghost" size="sm" asChild>
                <Link href="/signin/magic-link">Sign In</Link>
              </Button>
              <Button size="sm" asChild>
                <Link href="/start">
                  Get started
                  <ArrowRight className="ml-1 size-4" aria-hidden />
                </Link>
              </Button>
            </nav>
          </header>

          <div
            id="main-content"
            className={cn(
              "mx-auto w-full",
              variant === "auth" ? "max-w-xl" : "max-w-4xl",
            )}
            tabIndex={-1}
          >
            {children}
          </div>

          <div className="mt-10 border-t border-border/60 pt-8">
            <BrandedPortalFooter branding={branding} />
          </div>
        </div>
      </div>
    </div>
  );
}

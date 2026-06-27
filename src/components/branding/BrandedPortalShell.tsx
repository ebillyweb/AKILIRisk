import { BrandedPortalAuthSupplement } from "@/components/branding/BrandedPortalAuthSupplement";
import { BrandedPortalFooter } from "@/components/branding/BrandedPortalFooter";
import { BrandedPortalHeader } from "@/components/branding/BrandedPortalHeader";
import { getPreviewBrandHex } from "@/lib/branding/preview-hex";
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
 * Mirrors platform marketing layout: sticky header, hero surface, marketing cards.
 */
export function BrandedPortalShell({
  branding,
  homeHref = "/",
  children,
  variant = "auth",
  titleAsHeading = false,
}: BrandedPortalShellProps) {
  const previewHex = getPreviewBrandHex(branding);

  return (
    <div
      className={cn("min-h-screen pb-10 pt-2 sm:pb-12", previewHex && "branded-portal-shell")}
      style={
        previewHex
          ? ({
              "--branded-portal-shell-bg": previewHex.secondary,
              "--client-brand-primary": previewHex.primary,
            } as React.CSSProperties)
          : undefined
      }
    >
      <a href="#main-content" className="skip-to-content">
        Skip to main content
      </a>
      <div className="page-shell space-y-6 sm:space-y-8">
        <BrandedPortalHeader
          branding={branding}
          homeHref={homeHref}
          titleAsHeading={titleAsHeading}
        />

        {variant === "landing" ? (
          <div
            className="hero-surface app-grid overflow-hidden rounded-[2rem] px-6 py-8 sm:px-8 sm:py-10"
            style={
              previewHex
                ? {
                    borderColor: `${previewHex.primary}22`,
                  }
                : undefined
            }
          >
            <div id="main-content" className="mx-auto w-full min-w-0 max-w-4xl" tabIndex={-1}>
              {children}
            </div>
          </div>
        ) : (
          <div
            className="hero-surface app-grid grid overflow-hidden rounded-[2rem] lg:grid-cols-[1.05fr_0.95fr]"
            style={
              previewHex
                ? {
                    borderColor: `${previewHex.primary}22`,
                  }
                : undefined
            }
          >
            <section className="order-2 flex flex-col justify-between gap-8 border-t section-divider px-6 py-8 sm:px-8 lg:order-1 lg:border-t-0 lg:border-r lg:px-12 lg:py-12">
              <BrandedPortalAuthSupplement branding={branding} />
            </section>

            <section className="order-1 flex flex-col gap-6 px-4 py-6 sm:px-8 lg:order-2 lg:px-12 lg:py-10">
              <div
                id="main-content"
                className="flex w-full min-w-0 max-w-xl flex-1 items-center justify-center lg:mx-auto"
                tabIndex={-1}
              >
                {children}
              </div>
            </section>
          </div>
        )}

        <BrandedPortalFooter branding={branding} />
      </div>
    </div>
  );
}

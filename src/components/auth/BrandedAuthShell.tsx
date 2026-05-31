import { ClientPortalBrandedHeaderMark } from "@/components/layout/ClientPortalBrandedHeaderMark";
import {
  clientPortalBrandingDisplayTitle,
  clientPortalLogoImgSrc,
} from "@/lib/client/client-portal-branding";
import { getPreviewBrandHex } from "@/lib/branding/preview-hex";
import type { AdvisorBrandingData } from "@/lib/validation/branding";

type BrandedAuthShellProps = {
  branding: AdvisorBrandingData;
  subdomain?: string | null;
  children: React.ReactNode;
};

/**
 * Auth-route shell for tenant hosts and branded invite signup (replaces Akili lockup).
 */
export function BrandedAuthShell({
  branding,
  subdomain: _subdomain,
  children,
}: BrandedAuthShellProps) {
  const brandTitle = clientPortalBrandingDisplayTitle(branding);
  const logoSrc = clientPortalLogoImgSrc(branding);
  const previewHex = getPreviewBrandHex(branding);

  return (
    <div
      className="min-h-screen py-6 sm:py-8"
      style={
        previewHex
          ? {
              backgroundColor: previewHex.secondary,
            }
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
          <header className="mb-8 flex flex-col gap-2 border-b border-border/60 pb-6">
            <ClientPortalBrandedHeaderMark
              brandTitle={brandTitle}
              logoSrc={logoSrc}
              primaryHex={previewHex?.primary}
            />
            <p
              className="text-xs font-medium uppercase tracking-wide"
              style={previewHex ? { color: previewHex.primary, opacity: 0.72 } : undefined}
            >
              Brought to you by AKILI Risk Intelligence
            </p>
          </header>

          <div
            id="main-content"
            className="mx-auto flex w-full max-w-xl flex-col items-center justify-center"
            tabIndex={-1}
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

import { BrandedPortalShell } from "@/components/branding/BrandedPortalShell";
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
  return (
    <BrandedPortalShell branding={branding} homeHref="/" variant="auth">
      <div className="flex flex-col items-center justify-center">{children}</div>
    </BrandedPortalShell>
  );
}

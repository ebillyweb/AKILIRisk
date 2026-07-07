import { BrandedPortalShell } from "@/components/branding/BrandedPortalShell";
import { buildTenantScopedPublicPath } from "@/lib/advisor/tenant-path-portals";
import { getTenantPathPrefixFromHeaders } from "@/lib/client/tenant-path-prefix";
import type { AdvisorBrandingData } from "@/lib/validation/branding";

type BrandedAuthShellProps = {
  branding: AdvisorBrandingData;
  subdomain?: string | null;
  children: React.ReactNode;
};

/**
 * Auth-route shell for tenant hosts and branded invite signup (replaces Akili lockup).
 */
export async function BrandedAuthShell({
  branding,
  subdomain: _subdomain,
  children,
}: BrandedAuthShellProps) {
  const tenantPathPrefix = await getTenantPathPrefixFromHeaders();
  const homeHref = buildTenantScopedPublicPath("/", tenantPathPrefix);

  return (
    <BrandedPortalShell
      branding={branding}
      homeHref={homeHref}
      tenantPathPrefix={tenantPathPrefix}
      variant="auth"
    >
      <div className="flex w-full flex-col items-center justify-center">{children}</div>
    </BrandedPortalShell>
  );
}

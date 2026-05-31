import { headers } from "next/headers";
import { BrandingProvider } from "@/components/providers/BrandingProvider";
import { DefaultAuthShell } from "@/components/auth/DefaultAuthShell";
import { BrandedAuthShell } from "@/components/auth/BrandedAuthShell";
import { BrandingUnavailable } from "@/components/branding/BrandingUnavailable";
import { getTenantBrandingFromRequestHeaders } from "@/lib/client/tenant-portal-branding";
import { getTenantSubdomainFromHeaders } from "@/lib/client/branded-portal-requirements";
import { withClientPortalLogoSrc } from "@/lib/client/resolve-client-portal-branding";

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const headersList = await headers();
  const isTenantHost = headersList.get("x-branded-mode") === "true";

  if (isTenantHost) {
    const subdomain = await getTenantSubdomainFromHeaders();
    const tenantBranding = await getTenantBrandingFromRequestHeaders();

    if (!tenantBranding) {
      return (
        <div className="min-h-screen py-6 sm:py-8">
          <div className="page-shell">
            <BrandingUnavailable audience="client" />
          </div>
        </div>
      );
    }

    const branding = withClientPortalLogoSrc(tenantBranding, true);

    return (
      <BrandingProvider branding={branding} subdomain={subdomain}>
        <BrandedAuthShell branding={branding} subdomain={subdomain}>
          {children}
        </BrandedAuthShell>
      </BrandingProvider>
    );
  }

  return <DefaultAuthShell>{children}</DefaultAuthShell>;
}

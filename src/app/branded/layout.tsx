import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getAdvisorBrandingBySubdomain } from '@/lib/advisor/subdomain';
import { BrandingProvider } from '@/components/providers/BrandingProvider';
import { BrandingUnavailable } from '@/components/branding/BrandingUnavailable';
import { ClientPortalRootTheme } from '@/components/branding/ClientPortalRootTheme';
import { brandedPortalLogoImgSrc } from '@/lib/branding/branded-portal-logo';
import { clientPortalBrandingDisplayTitle } from '@/lib/client/client-portal-branding';
import { withClientPortalLogoSrc } from '@/lib/client/resolve-client-portal-branding';
import { TenantPublicThemeLock } from '@/components/theme/TenantPublicThemeLock';

const DEFAULT_BRANDED_TITLE = 'Risk Assessment Portal';

/**
 * Per-tenant <title> + description. Source: x-subdomain header set by
 * src/proxy.ts when the advisor's subdomain is active and verified.
 *
 * Uses `title.absolute` so the root layout's "%s | AKILI Risk Intelligence"
 * template doesn't co-brand a tenant's white-label portal.
 */
export async function generateMetadata(): Promise<Metadata> {
  const headersList = await headers();
  const subdomain = headersList.get('x-subdomain');
  if (!subdomain) {
    return { title: { absolute: DEFAULT_BRANDED_TITLE } };
  }
  const branding = await getAdvisorBrandingBySubdomain(subdomain);
  const brandName = branding
    ? clientPortalBrandingDisplayTitle(branding)
    : DEFAULT_BRANDED_TITLE;
  const logoSrc = branding ? brandedPortalLogoImgSrc(branding) : null;
  return {
    title: { absolute: brandName },
    description:
      branding?.tagline?.trim() ||
      'Comprehensive risk assessment and family governance analysis',
    ...(logoSrc ? { icons: { icon: [{ url: logoSrc }] } } : {}),
  };
}

export default async function BrandedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const headersList = await headers();
  const advisorId = headersList.get('x-advisor-id');
  const subdomain = headersList.get('x-subdomain');
  const brandedMode = headersList.get('x-branded-mode');

  if (!brandedMode || !advisorId || !subdomain) {
    redirect('/');
  }

  const branding = await getAdvisorBrandingBySubdomain(subdomain);

  if (!branding) {
    return <BrandingUnavailable audience="client" />;
  }

  const logoSrc = brandedPortalLogoImgSrc(branding);
  const portalBranding = withClientPortalLogoSrc(
    {
      ...branding,
      logoUrl: logoSrc ?? branding.logoUrl ?? undefined,
    },
    true,
  );

  return (
    <BrandingProvider branding={portalBranding} subdomain={subdomain}>
      <TenantPublicThemeLock />
      <ClientPortalRootTheme branding={portalBranding} />
      {children}
    </BrandingProvider>
  );
}

import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getAdvisorBrandingBySubdomain } from '@/lib/advisor/subdomain';
import { BrandingProvider } from '@/components/providers/BrandingProvider';
import { BrandingUnavailable } from '@/components/branding/BrandingUnavailable';
import { Toaster } from 'react-hot-toast';
import '@/app/globals.css';
import { brandedPortalLogoImgSrc } from '@/lib/branding/branded-portal-logo';

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
  const brandName = branding?.brandName?.trim() || DEFAULT_BRANDED_TITLE;
  return {
    title: { absolute: brandName },
    description:
      branding?.tagline?.trim() ||
      'Comprehensive risk assessment and family governance analysis',
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

  // If not in branded mode, redirect to main app
  if (!brandedMode || !advisorId || !subdomain) {
    redirect('/');
  }

  // Fetch advisor branding data
  const branding = await getAdvisorBrandingBySubdomain(subdomain);

  if (!branding) {
    return (
      <html lang="en">
        <body className="min-h-screen bg-background font-sans antialiased">
          <BrandingUnavailable audience="client" />
        </body>
      </html>
    );
  }

  const logoSrc = brandedPortalLogoImgSrc(branding);

  return (
    <html lang="en">
      <head>
        {logoSrc && <link rel="icon" href={logoSrc} />}
      </head>
      <body
        className="min-h-screen bg-background font-sans antialiased"
        style={{
          '--advisor-primary': branding.primaryColor || '#1a1a2e',
          '--advisor-secondary': branding.secondaryColor || '#f5f5f5',
          '--advisor-accent': branding.accentColor || '#10b981',
          '--advisor-logo-url': logoSrc ? `url(${logoSrc})` : 'none',
          '--advisor-brand-name': `"${branding.brandName || 'Risk Portal'}"`,
        } as React.CSSProperties}
        data-advisor-theme={`advisor-${advisorId}`}
        data-branded-mode="true"
      >
        <BrandingProvider
          branding={{
            ...branding,
            logoUrl: logoSrc ?? branding.logoUrl ?? undefined,
            advisorFirmName: branding.brandName, // Legacy support
          }}
          subdomain={subdomain}
        >
          {children}
          <Toaster position="top-right" />
        </BrandingProvider>
      </body>
    </html>
  );
}

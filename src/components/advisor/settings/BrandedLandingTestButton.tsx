'use client';

import { ExternalLink } from 'lucide-react';
import { toast } from 'react-hot-toast';

import type { AdvisorSubdomainSettings } from '@/lib/advisor/subdomain';
import {
  buildTenantPortalUrl,
  type TenantPortalUrlConfig,
} from '@/lib/branding/tenant-portal-url';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type BrandedLandingTestButtonProps = {
  currentSubdomain?: AdvisorSubdomainSettings | null;
  portalConfig: TenantPortalUrlConfig;
  customSubdomainEnabled: boolean;
  hasUnsavedChanges?: boolean;
  className?: string;
  size?: 'sm' | 'default';
};

export function BrandedLandingTestButton({
  currentSubdomain,
  portalConfig,
  customSubdomainEnabled,
  hasUnsavedChanges = false,
  className,
  size = 'sm',
}: BrandedLandingTestButtonProps) {
  const portalReady = Boolean(
    customSubdomainEnabled &&
      currentSubdomain?.dnsVerified &&
      currentSubdomain.subdomain,
  );

  const portalUrl = portalReady
    ? buildTenantPortalUrl(currentSubdomain!.subdomain, portalConfig)
    : null;

  const handleClick = () => {
    if (!portalUrl) return;

    if (hasUnsavedChanges) {
      toast(
        'Save your changes first — the live landing page shows saved branding.',
        { icon: 'ℹ️' },
      );
    }

    window.open(portalUrl, '_blank', 'noopener,noreferrer');
  };

  let disabledReason = 'Claim and activate a custom subdomain to test your live landing page.';
  if (!customSubdomainEnabled) {
    disabledReason =
      'Upgrade to Professional or higher to claim a custom subdomain and test your live landing page.';
  } else if (currentSubdomain && !currentSubdomain.dnsVerified) {
    disabledReason =
      'Your subdomain is not active yet. Finish setup under Custom Domain, then test the live landing page.';
  }

  return (
    <Button
      type="button"
      variant="outline"
      size={size}
      className={cn('gap-2', className)}
      disabled={!portalUrl}
      title={portalUrl ? 'Open your live branded client landing page' : disabledReason}
      onClick={handleClick}
      data-testid="branded-landing-test-button"
    >
      <ExternalLink className="size-4 shrink-0" aria-hidden />
      Test live landing page
    </Button>
  );
}

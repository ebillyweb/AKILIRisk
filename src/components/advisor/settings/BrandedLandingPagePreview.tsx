'use client';

import { BrandedLandingHero } from '@/components/branding/BrandedLandingHero';
import { BrandedPortalShell } from '@/components/branding/BrandedPortalShell';
import { resolveBrandedLandingCopy } from '@/lib/branding/landing-copy';
import { toAdvisorBrandingPreviewData } from '@/lib/branding/advisor-branding-preview-data';
import type { AdvisorBrandingData } from '@/lib/validation/branding';
import { buildAdvisorScopedThemeCss } from '@/lib/theming/advisor-root-theme';
import { cn } from '@/lib/utils';

const PREVIEW_SCOPE_CLASS = 'branded-landing-page-preview-scope';

type BrandedLandingPagePreviewProps = {
  branding: Partial<AdvisorBrandingData>;
  className?: string;
};

/**
 * Live landing page preview using the same shell + hero as tenant hosts.
 * Theme is scoped so advisor workspace tokens are not overwritten.
 */
export function BrandedLandingPagePreview({
  branding,
  className,
}: BrandedLandingPagePreviewProps) {
  const previewBranding = toAdvisorBrandingPreviewData(branding);
  const copy = resolveBrandedLandingCopy(previewBranding);
  const scopedThemeCss = buildAdvisorScopedThemeCss(
    previewBranding,
    `.${PREVIEW_SCOPE_CLASS}`,
  );
  const logoSrc = previewBranding.logoUrl?.trim() || null;

  return (
    <div
      className={cn(
        PREVIEW_SCOPE_CLASS,
        'light relative overflow-hidden rounded-xl border border-border/60 bg-background shadow-sm',
        className,
      )}
      aria-label="Client landing page preview"
    >
      {scopedThemeCss ? (
        <style dangerouslySetInnerHTML={{ __html: scopedThemeCss }} />
      ) : null}

      <div className="pointer-events-none max-h-[min(36rem,62vh)] overflow-y-auto overscroll-contain">
        <BrandedPortalShell
          branding={previewBranding}
          variant="landing"
          preview
          logoSrcOverride={logoSrc}
        >
          <BrandedLandingHero
            copy={copy}
            startHref="#"
            signInHref="#"
            requestReviewHref="#"
          />
          <p className="mt-8 text-center text-sm text-muted-foreground">
            Advisor or firm team member?{' '}
            <span className="font-semibold text-foreground underline-offset-4">
              Sign in to your workspace
            </span>
          </p>
        </BrandedPortalShell>
      </div>
    </div>
  );
}

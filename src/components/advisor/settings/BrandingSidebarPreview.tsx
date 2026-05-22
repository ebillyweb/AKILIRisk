'use client';

import type { AdvisorBrandingData } from '@/lib/validation/branding';
import { resolveAdvisorLogoSrcForPreview } from '@/lib/branding/advisor-logo-display';
import { cn } from '@/lib/utils';
import { Globe, Mail, Phone } from 'lucide-react';

interface BrandingSidebarPreviewProps {
  branding: Partial<AdvisorBrandingData>;
  className?: string;
}

/**
 * Compact client-portal style preview for the settings sidebar.
 */
export function BrandingSidebarPreview({
  branding,
  className,
}: BrandingSidebarPreviewProps) {
  const primary = branding.primaryColor?.trim() || 'hsl(var(--brand))';
  const secondary = branding.secondaryColor?.trim() || 'hsl(var(--muted))';
  const brandName = branding.brandName?.trim() || 'Your firm name';
  const logoSrc = resolveAdvisorLogoSrcForPreview(branding.logoUrl || null);

  return (
    <div
      className={cn(
        'overflow-hidden rounded-xl border border-border/60 bg-background shadow-sm',
        className
      )}
    >
      <div
        className="px-4 py-3 text-sm font-semibold text-white"
        style={{ backgroundColor: primary }}
      >
        Client portal header
      </div>
      <div
        className="flex items-center gap-3 border-b border-border/50 px-4 py-4"
        style={{ backgroundColor: secondary }}
      >
        {logoSrc ? (
          // eslint-disable-next-line @next/next/no-img-element -- dynamic advisor logo URLs (S3/presigned)
          <img
            src={logoSrc}
            alt=""
            className="h-10 w-10 shrink-0 rounded-md border border-border/40 bg-background object-contain p-1"
          />
        ) : (
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-dashed border-border/60 bg-background/80 text-[10px] font-medium uppercase tracking-wide text-muted-foreground"
            aria-hidden
          >
            Logo
          </div>
        )}
        <div className="min-w-0 space-y-0.5">
          <p className="truncate text-sm font-semibold leading-tight text-foreground">
            {brandName}
          </p>
          {branding.tagline ? (
            <p className="line-clamp-2 text-xs leading-snug text-muted-foreground italic">
              {branding.tagline}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">Tagline appears here</p>
          )}
        </div>
      </div>
      <div className="space-y-2 px-4 py-3 text-xs text-muted-foreground">
        {branding.websiteUrl ? (
          <p className="flex items-center gap-2 break-all">
            <Globe className="size-3.5 shrink-0" aria-hidden />
            <span className="text-foreground/80">{branding.websiteUrl}</span>
          </p>
        ) : null}
        {branding.supportEmail ? (
          <p className="flex items-center gap-2">
            <Mail className="size-3.5 shrink-0" aria-hidden />
            {branding.supportEmail}
          </p>
        ) : null}
        {branding.supportPhone ? (
          <p className="flex items-center gap-2">
            <Phone className="size-3.5 shrink-0" aria-hidden />
            {branding.supportPhone}
          </p>
        ) : null}
        {!branding.websiteUrl && !branding.supportEmail && !branding.supportPhone ? (
          <p className="leading-relaxed">
            Support contact details appear on branded emails and portals when you add them
            under Client support.
          </p>
        ) : null}
      </div>
    </div>
  );
}

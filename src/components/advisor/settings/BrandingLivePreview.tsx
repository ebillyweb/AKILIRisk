'use client';

import { FileText, LayoutDashboard, Mail } from 'lucide-react';

import { BrandedLandingPagePreview } from '@/components/advisor/settings/BrandedLandingPagePreview';
import { BrandedLandingTestButton } from '@/components/advisor/settings/BrandedLandingTestButton';
import { BrandingPreview } from '@/components/advisor/settings/BrandingPreview';
import type { AdvisorSubdomainSettings } from '@/lib/advisor/subdomain';
import type { AdvisorBrandingData } from '@/lib/validation/branding';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

type PortalConfig = {
  productionDomain: string;
  tenantSubdomainSuffix: string;
  useTenantPathPortals: boolean;
  platformAppOrigin: string;
  stagingPlatformHost: string;
};

type BrandingLivePreviewProps = {
  branding: Partial<AdvisorBrandingData>;
  readOnly?: boolean;
  isDirty?: boolean;
  currentSubdomain?: AdvisorSubdomainSettings | null;
  portalConfig: PortalConfig;
  customSubdomainEnabled: boolean;
  showColorSwatches?: boolean;
  className?: string;
};

const TOUCHPOINT_TABS = [
  { id: 'email', label: 'Email', icon: Mail },
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'pdf', label: 'Report', icon: FileText },
] as const;

export function BrandingLivePreview({
  branding,
  readOnly = false,
  isDirty = false,
  currentSubdomain = null,
  portalConfig,
  customSubdomainEnabled,
  showColorSwatches = false,
  className,
}: BrandingLivePreviewProps) {
  const accent = branding.primaryColor?.trim() || '#4EA5D9';

  return (
    <section
      className={cn(
        'relative overflow-hidden border-b border-border/60 bg-gradient-to-b from-muted/40 via-muted/20 to-background',
        className,
      )}
      aria-label="Live branding preview"
    >
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-32 opacity-[0.14]"
        style={{
          background: `radial-gradient(ellipse 80% 70% at 50% -20%, ${accent}, transparent)`,
        }}
        aria-hidden
      />

      <div className="relative space-y-5 px-4 py-5 sm:px-6 sm:py-6 lg:px-8 lg:py-7">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2.5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Live preview
              </p>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-800 dark:text-emerald-300">
                <span className="size-1.5 animate-pulse rounded-full bg-emerald-500" aria-hidden />
                Synced
              </span>
            </div>
            <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">
              {readOnly
                ? 'Client landing page and touchpoints as households experience them.'
                : 'Landing page updates as you edit. Save to publish changes to your live tenant portal.'}
            </p>
          </div>
          <BrandedLandingTestButton
            currentSubdomain={currentSubdomain}
            portalConfig={portalConfig}
            customSubdomainEnabled={customSubdomainEnabled}
            hasUnsavedChanges={isDirty}
            className="w-full shrink-0 sm:w-auto"
          />
        </div>

        <div className="space-y-3">
          <p className="text-xs font-medium text-muted-foreground">Client landing page</p>
          <BrandedLandingPagePreview branding={branding} />
        </div>

        {showColorSwatches ? (
          <div className="grid max-w-md grid-cols-3 gap-2">
            {(
              [
                ['Primary', branding.primaryColor],
                ['Secondary', branding.secondaryColor],
                ['Accent', branding.accentColor],
              ] as const
            ).map(([label, color]) =>
              color ? (
                <div
                  key={label}
                  className="overflow-hidden rounded-lg border border-border/60 bg-card/80"
                >
                  <div className="h-9" style={{ backgroundColor: color }} />
                  <p className="px-2 py-1.5 text-center text-[10px] font-medium text-muted-foreground">
                    {label}
                  </p>
                </div>
              ) : null,
            )}
          </div>
        ) : null}

        <div className="space-y-3">
          <p className="text-xs font-medium text-muted-foreground">Other touchpoints</p>
          <div className="flex min-h-0 min-w-0 flex-col rounded-xl border border-border/60 bg-card/80 p-3 shadow-sm backdrop-blur-sm sm:p-4">
            <Tabs defaultValue="email" className="flex min-h-0 flex-1 flex-col gap-3">
              <TabsList
                variant="line"
                className="h-auto w-full shrink-0 justify-start gap-1 border-border/50 bg-transparent p-0"
              >
                {TOUCHPOINT_TABS.map(({ id, label, icon: Icon }) => (
                  <TabsTrigger
                    key={id}
                    value={id}
                    className="gap-1.5 rounded-md px-3 py-2 text-xs data-[state=active]:bg-muted/60 sm:text-sm"
                  >
                    <Icon className="size-3.5 shrink-0" aria-hidden />
                    {label}
                  </TabsTrigger>
                ))}
              </TabsList>

              {TOUCHPOINT_TABS.map(({ id }) => (
                <TabsContent
                  key={id}
                  value={id}
                  className="mt-0 min-h-0 flex-1 outline-none data-[state=inactive]:hidden"
                >
                  <div className="max-h-[min(20rem,42vh)] overflow-y-auto rounded-lg border border-border/50 bg-muted/15 p-1">
                    <BrandingPreview
                      type={id}
                      branding={branding}
                      className="mx-auto w-full max-w-lg"
                    />
                  </div>
                </TabsContent>
              ))}
            </Tabs>
          </div>
        </div>
      </div>
    </section>
  );
}

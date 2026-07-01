'use client';

import {
  useState,
  useCallback,
  useEffect,
  useRef,
  useMemo,
  useSyncExternalStore,
} from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'react-hot-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { FieldHelpKey } from '@/lib/field-help/content';
import { FieldHelp, LabelWithHelp } from '@/components/ui/field-help';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import ColorPicker from '@/components/ui/color-picker';
import { FileUpload } from '@/components/ui/file-upload';
import { BrandingSidebarPreview } from '@/components/advisor/settings/BrandingSidebarPreview';
import { BrandedLandingTestButton } from '@/components/advisor/settings/BrandedLandingTestButton';
import { PreviewContainer } from '@/components/advisor/settings/BrandingPreview';
import { TierFeatureLockIcon, TierFeatureUpgradeButton } from '@/components/advisor/billing/TierFeatureUpgrade';
import { SubdomainManager } from '@/components/advisor/settings/SubdomainManager';
import {
  brandingUpdateSchema,
  BrandingFormData,
  LOGO_MAX_BYTES,
  SubscriptionFeatures,
} from '@/lib/validation/branding';
import type { AdvisorSubdomainSettings } from '@/lib/advisor/subdomain';
import { updateAdvisorBrandingAction } from '@/lib/actions/advisor-branding-actions';
import { resolveAdvisorLogoSrcForPreview } from '@/lib/branding/advisor-logo-display';
import { resolveBrandedLandingCopy } from '@/lib/branding/landing-copy';
import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';
import {
  Building,
  Palette,
  Image as ImageIcon,
  Phone,
  Globe,
  Eye,
  Lock,
  Loader2,
  Check,
} from 'lucide-react';

function subscribeXl(callback: () => void) {
  const mq = window.matchMedia('(min-width: 1280px)');
  mq.addEventListener('change', callback);
  return () => mq.removeEventListener('change', callback);
}

function getXlSnapshot() {
  return window.matchMedia('(min-width: 1280px)').matches;
}

function useXlSidebarNav() {
  return useSyncExternalStore(subscribeXl, getXlSnapshot, () => false);
}

interface EnhancedBrandingFormProps {
  profile: {
    firmName?: string | null;
    brandName?: string | null;
    tagline?: string | null;
    landingKicker?: string | null;
    landingHeadline?: string | null;
    landingSubheadline?: string | null;
    landingSubtext?: string | null;
    primaryColor?: string | null;
    secondaryColor?: string | null;
    accentColor?: string | null;
    websiteUrl?: string | null;
    emailFooterText?: string | null;
    supportEmail?: string | null;
    supportPhone?: string | null;
    logoUrl?: string | null;
    logoS3Key?: string | null;
    logoContentType?: string | null;
    logoFileSize?: number | null;
    logoUploadedAt?: Date | null;
  };
  /** Firm advisors view canonical enterprise branding without editing. */
  readOnly?: boolean;
  readOnlyNotice?: string;
  /** When true, hide subdomain management (e.g. firm members without subdomain permission). */
  subdomainReadOnly?: boolean;
  features: SubscriptionFeatures;
  currentSubdomain?: AdvisorSubdomainSettings | null;
  productionDomain: string;
  tenantSubdomainSuffix?: string;
  useTenantPathPortals?: boolean;
  platformAppOrigin?: string;
  stagingPlatformHost?: string;
  platformSubdomainsAutoActivate?: boolean;
}

const FORM_SECTIONS = [
  {
    id: 'identity',
    title: 'Brand Identity',
    shortTitle: 'Brand',
    icon: Building,
    description: 'Basic brand information',
  },
  {
    id: 'colors',
    title: 'Colors & Style',
    shortTitle: 'Style',
    icon: Palette,
    description: 'Brand colors and theming',
    premium: true,
  },
  {
    id: 'assets',
    title: 'Logo & Assets',
    shortTitle: 'Logo',
    icon: ImageIcon,
    description: 'Upload and manage your logo',
  },
  {
    id: 'contact',
    title: 'Client support',
    shortTitle: 'Support',
    icon: Phone,
    description: 'Client-facing support details',
  },
  {
    id: 'domain',
    title: 'Custom Domain',
    shortTitle: 'Domain',
    icon: Globe,
    description: 'Custom subdomain setup',
    premium: true,
  },
  {
    id: 'preview',
    title: 'Live Preview',
    shortTitle: 'Preview',
    icon: Eye,
    description: 'See how your branding looks',
  },
] as const;

const SIDEBAR_PREVIEW_TABS = new Set(['identity', 'colors', 'assets', 'contact']);

type FormSectionId = (typeof FORM_SECTIONS)[number]['id'];

function SettingsSection({
  title,
  description,
  icon: Icon,
  helpKey,
  children,
}: {
  title: string;
  description: string;
  icon: LucideIcon;
  helpKey?: FieldHelpKey;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-5">
      <div className="space-y-1 border-b border-border/50 pb-4">
        <h2 className="flex items-center gap-2 text-base font-semibold tracking-tight">
          <Icon className="size-4 text-muted-foreground" aria-hidden />
          {title}
          {helpKey ? <FieldHelp helpKey={helpKey} triggerLabel={title} /> : null}
        </h2>
        <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

export function EnhancedBrandingForm({
  profile,
  readOnly = false,
  readOnlyNotice,
  subdomainReadOnly = false,
  features,
  currentSubdomain = null,
  productionDomain,
  tenantSubdomainSuffix = '',
  useTenantPathPortals = false,
  platformAppOrigin = '',
  stagingPlatformHost = 'preview.akilirisk.com',
  platformSubdomainsAutoActivate = true,
}: EnhancedBrandingFormProps) {
  const xlSidebar = useXlSidebarNav();
  const showDomainSection = !readOnly && !subdomainReadOnly;
  const visibleSections = showDomainSection
    ? FORM_SECTIONS
    : FORM_SECTIONS.filter((section) => section.id !== "domain");

  const displayBrandName =
    profile.brandName?.trim() || profile.firmName?.trim() || '';

  const defaultFormValues: BrandingFormData = {
    brandName: displayBrandName,
    tagline: profile.tagline || '',
    landingKicker: profile.landingKicker || '',
    landingHeadline: profile.landingHeadline || '',
    landingSubheadline: profile.landingSubheadline || '',
    landingSubtext: profile.landingSubtext || '',
    primaryColor: profile.primaryColor || '',
    secondaryColor: profile.secondaryColor || '',
    accentColor: profile.accentColor || '',
    websiteUrl: profile.websiteUrl || '',
    emailFooterText: profile.emailFooterText || '',
    supportEmail: profile.supportEmail || '',
    supportPhone: profile.supportPhone || '',
    logoUrl: profile.logoUrl || '',
  };

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSavedFlash, setShowSavedFlash] = useState(false);
  const savedFlashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [activeSection, setActiveSection] = useState('identity');
  const mobileTabsListRef = useRef<HTMLDivElement | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
    watch,
    setValue,
    reset,
  } = useForm<BrandingFormData>({
    resolver: zodResolver(brandingUpdateSchema),
    defaultValues: defaultFormValues,
  });

  // Live preview (don't mirror watch() into state — new object every render → infinite loop)
  const watchedValues = watch();

  const brandingForPreview = useMemo(
    () => ({
      ...watchedValues,
      logoUrl: resolveAdvisorLogoSrcForPreview(watchedValues.logoUrl || profile.logoUrl || null),
    }),
    [watchedValues, profile.logoUrl]
  );

  const landingPreviewCopy = useMemo(
    () => resolveBrandedLandingCopy(brandingForPreview),
    [brandingForPreview],
  );

  const portalConfig = useMemo(
    () => ({
      productionDomain,
      tenantSubdomainSuffix,
      useTenantPathPortals,
      platformAppOrigin,
      stagingPlatformHost,
    }),
    [
      productionDomain,
      tenantSubdomainSuffix,
      useTenantPathPortals,
      platformAppOrigin,
      stagingPlatformHost,
    ],
  );

  useEffect(() => {
    if (isDirty) {
      setShowSavedFlash(false);
    }
  }, [isDirty]);

  useEffect(() => {
    return () => {
      if (savedFlashTimerRef.current) {
        clearTimeout(savedFlashTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (xlSidebar || !mobileTabsListRef.current) {
      return;
    }

    if (mobileTabsListRef.current.scrollWidth <= mobileTabsListRef.current.clientWidth) {
      return;
    }

    const activeTab = mobileTabsListRef.current.querySelector<HTMLElement>(
      '[role="tab"][data-state="active"]'
    );

    if (!activeTab) {
      return;
    }

    activeTab.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',
      inline: 'center',
    });
  }, [activeSection, xlSidebar]);

  const flashSaved = useCallback(() => {
    if (savedFlashTimerRef.current) {
      clearTimeout(savedFlashTimerRef.current);
    }
    setShowSavedFlash(true);
    savedFlashTimerRef.current = setTimeout(() => {
      setShowSavedFlash(false);
      savedFlashTimerRef.current = null;
    }, 2800);
  }, []);

  const onSubmit = async (data: BrandingFormData) => {
    if (readOnly) return;
    setIsSubmitting(true);
    setShowSavedFlash(false);
    try {
      const formData = new FormData();
      Object.entries(data).forEach(([key, value]) => {
        if (value) formData.append(key, value);
      });

      const result = await updateAdvisorBrandingAction(formData);

      if (result.success) {
        toast.success('Branding updated successfully');
        reset(data);
        flashSaved();
      } else {
        toast.error(result.error || 'Failed to update branding');
      }
    } catch (error) {
      toast.error('An unexpected error occurred');
      console.error('Branding update error:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle logo upload
  const handleLogoUpload = useCallback(async (file: File): Promise<string> => {
    if (readOnly) {
      throw new Error('Firm branding is read-only for your role.');
    }
    try {
      // Same-origin upload — server writes to S3 (no browser CORS to the bucket)
      const formData = new FormData();
      formData.append('file', file);

      const uploadResponse = await fetch('/api/advisor/branding/logo/direct', {
        method: 'POST',
        body: formData,
      });

      const payload = await uploadResponse.json();

      if (!uploadResponse.ok || !payload.success) {
        throw new Error(payload.error || 'Failed to upload logo');
      }

      const confirmData = payload.data as { logoUrl: string; s3Key: string };

      setValue('logoUrl', confirmData.logoUrl, { shouldDirty: true });

      return confirmData.logoUrl;
    } catch (error) {
      console.error('Logo upload error:', error);
      throw new Error(error instanceof Error ? error.message : 'Upload failed');
    }
  }, [readOnly, setValue]);

  // Get upgrade message for restricted features
  const getUpgradeMessage = (sectionId: string): string => {
    switch (sectionId) {
      case 'colors':
        return 'Custom brand colors are available on Professional and higher plans.';
      case 'domain':
        return 'Custom subdomains are available on Professional and higher plans.';
      default:
        return 'This feature requires a subscription upgrade.';
    }
  };

  const showSidebarPreview = SIDEBAR_PREVIEW_TABS.has(
    activeSection as FormSectionId
  );

  return (
    <div
      className={cn(
        'grid grid-cols-1 gap-6 lg:gap-8',
        showSidebarPreview &&
          'xl:grid-cols-[minmax(0,1fr)_minmax(260px,300px)]'
      )}
    >
      <div className="min-w-0 overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm">
        <Tabs
          value={activeSection}
          onValueChange={setActiveSection}
          orientation={xlSidebar ? 'vertical' : 'horizontal'}
          className={cn(
            'gap-0',
            xlSidebar && 'xl:flex-row xl:items-stretch'
          )}
        >
          <TabsList
            variant="line"
            aria-label="Branding settings sections"
            ref={mobileTabsListRef}
            className={cn(
              'w-full shrink-0 gap-0 rounded-none border-border/60 bg-muted/25 p-2 text-muted-foreground',
              xlSidebar
                ? 'xl:sticky xl:top-20 xl:z-10 xl:w-[13.5rem] xl:flex-col xl:border-r xl:bg-muted/20 xl:px-2 xl:py-4'
                : '!grid !h-auto w-full grid-cols-2 gap-1.5 border-b pb-2 sm:grid-cols-3'
            )}
          >
              {visibleSections.map((section) => {
                const showUpgradeHint =
                  (section.id === 'colors' &&
                    section.premium &&
                    !features.advancedBrandingEnabled) ||
                  (section.id === 'domain' &&
                    section.premium &&
                    !features.customSubdomainEnabled);

                return (
                  <TabsTrigger
                    key={section.id}
                    value={section.id}
                    className={cn(
                      'min-h-10 w-full rounded-md text-left text-xs font-medium sm:text-sm',
                      'data-[state=active]:bg-background/90 data-[state=active]:shadow-none',
                      xlSidebar
                        ? 'h-auto flex-col items-stretch gap-1 px-3 py-2.5'
                        : 'h-auto min-w-0 flex-none justify-center px-2 py-2.5'
                    )}
                  >
                    <span
                      className={cn(
                        'flex w-full items-center gap-2',
                        xlSidebar ? 'justify-start' : 'justify-center sm:justify-center'
                      )}
                    >
                      <section.icon
                        className={cn(
                          'size-4 shrink-0 transition-opacity',
                          !xlSidebar && 'hidden'
                        )}
                        aria-hidden
                      />
                      <span className="leading-tight">
                        {xlSidebar ? section.title : section.shortTitle}
                      </span>
                      {showUpgradeHint ? (
                        <TierFeatureLockIcon
                          className="ml-auto !opacity-100"
                          label="Requires plan upgrade"
                        />
                      ) : null}
                    </span>
                    {xlSidebar ? (
                      <span className="text-[11px] font-normal leading-snug text-muted-foreground">
                        {section.description}
                      </span>
                    ) : null}
                  </TabsTrigger>
                );
              })}
            </TabsList>

            <form
              onSubmit={handleSubmit(onSubmit)}
              className="flex min-w-0 flex-1 flex-col"
            >
              <div className="min-w-0 flex-1 space-y-6 px-4 py-6 sm:px-6 sm:py-8">
              {readOnly && readOnlyNotice ? (
                <Alert>
                  <Lock className="h-4 w-4" aria-hidden />
                  <AlertDescription>{readOnlyNotice}</AlertDescription>
                </Alert>
              ) : null}
              {/* RHF only submits registered fields; ColorPickers use setValue only */}
              {readOnly ? (
                <input type="hidden" {...register('brandName')} />
              ) : null}
              <input type="hidden" {...register('primaryColor')} />
              <input type="hidden" {...register('secondaryColor')} />
              <input type="hidden" {...register('accentColor')} />
              <input type="hidden" {...register('logoUrl')} />
              <TabsContent value="identity" className="mt-0 outline-none">
                <SettingsSection
                  title="Brand identity"
                  description="How clients see your firm on branded portals, emails, and reports."
                  icon={Building}
                >
                  <div className="space-y-2">
                    <Label htmlFor="brandNameDisplay">Public brand name</Label>
                    {readOnly ? (
                      <Input
                        id="brandNameDisplay"
                        value={displayBrandName || '—'}
                        readOnly
                        disabled
                        className="bg-muted/40"
                      />
                    ) : (
                      <Input
                        id="brandNameDisplay"
                        {...register('brandName')}
                        placeholder="Your firm or public-facing name"
                        maxLength={100}
                        aria-invalid={errors.brandName ? true : undefined}
                      />
                    )}
                    {errors.brandName && (
                      <p className="text-sm text-destructive">{errors.brandName.message}</p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {readOnly
                        ? 'Managed centrally for your firm. Contact a firm owner or administrator to change it.'
                        : 'Shown to clients on branded portals, emails, and reports.'}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <LabelWithHelp htmlFor="tagline" helpKey="branding-tagline">
                      Header tagline
                    </LabelWithHelp>
                    <Textarea
                      id="tagline"
                      {...register('tagline')}
                      placeholder="Optional short line under your logo in the portal header"
                      maxLength={150}
                      rows={2}
                      readOnly={readOnly}
                      disabled={readOnly}
                      className={readOnly ? 'bg-muted/40' : undefined}
                    />
                    {errors.tagline && (
                      <p className="text-sm text-destructive">{errors.tagline.message}</p>
                    )}
                  </div>

                  <div className="space-y-4 rounded-xl border border-border/60 bg-muted/15 p-4">
                    <div className="space-y-1">
                      <h3 className="text-sm font-semibold tracking-tight">Client landing page</h3>
                      <p className="text-xs leading-relaxed text-muted-foreground">
                        Customize the hero on your white-label portal. Leave blank to use AKILI&apos;s
                        default family-facing copy.
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="landingKicker">Kicker</Label>
                      <Input
                        id="landingKicker"
                        {...register('landingKicker')}
                        placeholder={landingPreviewCopy.kicker}
                        maxLength={80}
                        readOnly={readOnly}
                        disabled={readOnly}
                        className={readOnly ? 'bg-muted/40' : undefined}
                      />
                      {errors.landingKicker ? (
                        <p className="text-sm text-destructive">{errors.landingKicker.message}</p>
                      ) : null}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="landingHeadline">Headline</Label>
                      <Textarea
                        id="landingHeadline"
                        {...register('landingHeadline')}
                        placeholder={landingPreviewCopy.headline}
                        maxLength={200}
                        rows={2}
                        readOnly={readOnly}
                        disabled={readOnly}
                        className={readOnly ? 'bg-muted/40' : undefined}
                      />
                      {errors.landingHeadline ? (
                        <p className="text-sm text-destructive">{errors.landingHeadline.message}</p>
                      ) : null}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="landingSubheadline">Subheadline</Label>
                      <Textarea
                        id="landingSubheadline"
                        {...register('landingSubheadline')}
                        placeholder={landingPreviewCopy.subheadline}
                        maxLength={300}
                        rows={3}
                        readOnly={readOnly}
                        disabled={readOnly}
                        className={readOnly ? 'bg-muted/40' : undefined}
                      />
                      {errors.landingSubheadline ? (
                        <p className="text-sm text-destructive">
                          {errors.landingSubheadline.message}
                        </p>
                      ) : null}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="landingSubtext">Supporting line</Label>
                      <Input
                        id="landingSubtext"
                        {...register('landingSubtext')}
                        placeholder={landingPreviewCopy.subtext}
                        maxLength={120}
                        readOnly={readOnly}
                        disabled={readOnly}
                        className={readOnly ? 'bg-muted/40' : undefined}
                      />
                      {errors.landingSubtext ? (
                        <p className="text-sm text-destructive">{errors.landingSubtext.message}</p>
                      ) : null}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <LabelWithHelp htmlFor="websiteUrl" helpKey="branding-website">
                      Website URL
                    </LabelWithHelp>
                    <Input
                      id="websiteUrl"
                      type="url"
                      {...register('websiteUrl')}
                      placeholder="https://your-website.com"
                      readOnly={readOnly}
                      disabled={readOnly}
                      className={readOnly ? 'bg-muted/40' : undefined}
                    />
                    {errors.websiteUrl && (
                      <p className="text-sm text-destructive">{errors.websiteUrl.message}</p>
                    )}
                  </div>
                </SettingsSection>
              </TabsContent>

              <TabsContent value="colors" className="mt-0 outline-none">
                <SettingsSection
                  title="Brand colors"
                  description="Primary, secondary, and accent colors on client portals and emails."
                  icon={Palette}
                  helpKey="branding-colors"
                >
                  {!features.advancedBrandingEnabled ? (
                    <Alert>
                      <Lock className="h-4 w-4" aria-hidden />
                      <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <span>{getUpgradeMessage('colors')}</span>
                        <TierFeatureUpgradeButton feature="ADVANCED_BRANDING" size="sm" />
                      </AlertDescription>
                    </Alert>
                  ) : (
                    <>
                      <ColorPicker
                        label="Primary Color"
                        value={watchedValues.primaryColor || ''}
                        onChange={(color) =>
                          setValue('primaryColor', color, { shouldDirty: true })
                        }
                        error={errors.primaryColor?.message}
                        showHarmony
                        disabled={readOnly}
                      />
                      <ColorPicker
                        label="Secondary Color"
                        value={watchedValues.secondaryColor || ''}
                        onChange={(color) =>
                          setValue('secondaryColor', color, { shouldDirty: true })
                        }
                        error={errors.secondaryColor?.message}
                        disabled={readOnly}
                      />
                      <ColorPicker
                        label="Accent Color"
                        value={watchedValues.accentColor || ''}
                        onChange={(color) =>
                          setValue('accentColor', color, { shouldDirty: true })
                        }
                        error={errors.accentColor?.message}
                        disabled={readOnly}
                      />
                    </>
                  )}
                </SettingsSection>
              </TabsContent>

              <TabsContent value="assets" className="mt-0 outline-none">
                <SettingsSection
                  title="Logo"
                  description="PNG, JPEG, or SVG — max 5MB. Shown on client portals and reports."
                  icon={ImageIcon}
                  helpKey="branding-logo"
                >
                  <FileUpload
                    accept="image/*"
                    maxSize={LOGO_MAX_BYTES}
                    onUpload={handleLogoUpload}
                    currentFile={watchedValues.logoUrl || profile.logoUrl || null}
                    disabled={readOnly}
                  />
                </SettingsSection>
              </TabsContent>

              <TabsContent value="contact" className="mt-0 outline-none">
                <SettingsSection
                  title="Client support"
                  description="Support details clients see on branded emails and portals — not your personal advisor profile."
                  icon={Phone}
                >
                  <div className="space-y-2">
                    <LabelWithHelp htmlFor="supportEmail" helpKey="branding-support-email">
                      Support email
                    </LabelWithHelp>
                    <Input
                      id="supportEmail"
                      type="email"
                      {...register('supportEmail')}
                      placeholder="support@yourcompany.com"
                      readOnly={readOnly}
                      disabled={readOnly}
                      className={readOnly ? 'bg-muted/40' : undefined}
                    />
                    {errors.supportEmail && (
                      <p className="text-sm text-destructive">{errors.supportEmail.message}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <LabelWithHelp htmlFor="supportPhone" helpKey="branding-support-phone">
                      Support phone
                    </LabelWithHelp>
                    <Input
                      id="supportPhone"
                      type="tel"
                      {...register('supportPhone')}
                      placeholder="+1 (555) 123-4567"
                      readOnly={readOnly}
                      disabled={readOnly}
                      className={readOnly ? 'bg-muted/40' : undefined}
                    />
                    {errors.supportPhone && (
                      <p className="text-sm text-destructive">{errors.supportPhone.message}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <LabelWithHelp htmlFor="emailFooterText" helpKey="branding-email-footer">
                      Email footer text
                    </LabelWithHelp>
                    <Textarea
                      id="emailFooterText"
                      {...register('emailFooterText')}
                      placeholder="Custom footer text for email communications"
                      maxLength={300}
                      rows={3}
                      readOnly={readOnly}
                      disabled={readOnly}
                      className={readOnly ? 'bg-muted/40' : undefined}
                    />
                    {errors.emailFooterText && (
                      <p className="text-sm text-destructive">{errors.emailFooterText.message}</p>
                    )}
                  </div>
                </SettingsSection>
              </TabsContent>

              <TabsContent value="domain" className="mt-0 outline-none">
                <SubdomainManager
                  features={features}
                  currentSubdomain={currentSubdomain}
                  productionDomain={productionDomain}
                  tenantSubdomainSuffix={tenantSubdomainSuffix}
                  useTenantPathPortals={useTenantPathPortals}
                  platformAppOrigin={platformAppOrigin}
                  stagingPlatformHost={stagingPlatformHost}
                  platformSubdomainsAutoActivate={platformSubdomainsAutoActivate}
                  readOnly={readOnly}
                />
              </TabsContent>

              <TabsContent value="preview" className="mt-0 outline-none">
                <SettingsSection
                  title="Live preview"
                  description="Mockups for email, dashboard, and PDF touchpoints. Open your live tenant landing page to verify the full client experience."
                  icon={Eye}
                >
                  <div className="flex flex-wrap items-center gap-3">
                    <BrandedLandingTestButton
                      currentSubdomain={currentSubdomain}
                      portalConfig={portalConfig}
                      customSubdomainEnabled={features.customSubdomainEnabled}
                      hasUnsavedChanges={isDirty}
                    />
                    {!features.customSubdomainEnabled ? (
                      <p className="text-sm text-muted-foreground">
                        Custom subdomains require Professional or higher.
                      </p>
                    ) : !currentSubdomain?.dnsVerified ? (
                      <p className="text-sm text-muted-foreground">
                        Claim a subdomain under Custom Domain to test the live landing page.
                      </p>
                    ) : null}
                  </div>
                  <PreviewContainer branding={brandingForPreview} />
                </SettingsSection>
              </TabsContent>
              </div>

              {!readOnly ? (
              <div className="sticky bottom-0 z-10 space-y-3 border-t border-border/60 bg-card/95 px-4 py-4 backdrop-blur-sm sm:px-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch sm:gap-3">
                  <Button
                    type="submit"
                    disabled={!isDirty || isSubmitting}
                    aria-busy={isSubmitting}
                    className={cn(
                      'min-h-11 flex-1 gap-2 transition-[color,box-shadow,background-color,border-color] sm:max-w-xs',
                      showSavedFlash &&
                        !isSubmitting &&
                        'border border-emerald-600/85 bg-emerald-50 text-emerald-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.65)] hover:bg-emerald-50 dark:border-emerald-500/60 dark:bg-emerald-950/45 dark:text-emerald-50 dark:hover:bg-emerald-950/45 dark:shadow-none disabled:opacity-100'
                    )}
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
                        Saving…
                      </>
                    ) : showSavedFlash ? (
                      <>
                        <Check className="h-4 w-4 shrink-0" strokeWidth={2.5} aria-hidden />
                        Saved
                      </>
                    ) : (
                      'Save Changes'
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => reset()}
                    disabled={!isDirty || isSubmitting}
                    className="min-h-11 shrink-0"
                  >
                    Reset
                  </Button>
                </div>
                <p
                  role="status"
                  aria-live="polite"
                  className={cn(
                    'min-h-[1.25rem] text-sm',
                    isSubmitting && 'text-muted-foreground',
                    showSavedFlash && !isSubmitting && 'font-medium text-emerald-800 dark:text-emerald-300',
                    !isSubmitting && !showSavedFlash && 'text-transparent'
                  )}
                >
                  {isSubmitting
                    ? 'Saving your branding…'
                    : showSavedFlash
                      ? 'All changes are saved.'
                      : ' '}
                </p>
              </div>
              ) : null}
            </form>
          </Tabs>
      </div>

      {showSidebarPreview ? (
        <aside className="min-w-0 space-y-4 xl:sticky xl:top-20 xl:self-start">
          <div className="space-y-3 px-1">
            <div className="space-y-1">
              <p className="text-sm font-semibold tracking-tight">Live preview</p>
              <p className="text-xs leading-relaxed text-muted-foreground">
                {readOnly
                  ? 'Firm branding as clients see it on portals and emails.'
                  : 'Updates as you edit. Use Test live landing page for the real tenant portal.'}
              </p>
            </div>
            <BrandedLandingTestButton
              currentSubdomain={currentSubdomain}
              portalConfig={portalConfig}
              customSubdomainEnabled={features.customSubdomainEnabled}
              hasUnsavedChanges={isDirty}
              className="w-full justify-center"
            />
          </div>
          <BrandingSidebarPreview branding={brandingForPreview} />
          {features.advancedBrandingEnabled &&
          (watchedValues.primaryColor ||
            watchedValues.secondaryColor ||
            watchedValues.accentColor) ? (
            <div className="grid grid-cols-3 gap-2 rounded-xl border border-border/60 bg-muted/20 p-3">
              {(
                [
                  ['Primary', watchedValues.primaryColor],
                  ['Secondary', watchedValues.secondaryColor],
                  ['Accent', watchedValues.accentColor],
                ] as const
              ).map(([label, color]) =>
                color ? (
                  <div key={label} className="space-y-1">
                    <div
                      className="h-8 rounded-md border border-border/50"
                      style={{ backgroundColor: color }}
                    />
                    <p className="text-center text-[10px] font-medium text-muted-foreground">
                      {label}
                    </p>
                  </div>
                ) : null
              )}
            </div>
          ) : null}
        </aside>
      ) : null}
    </div>
  );
}
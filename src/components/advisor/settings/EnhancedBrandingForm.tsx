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
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import ColorPicker from '@/components/ui/color-picker';
import { FileUpload } from '@/components/ui/file-upload';
import { BrandingSidebarPreview } from '@/components/advisor/settings/BrandingSidebarPreview';
import { PreviewContainer } from '@/components/advisor/settings/BrandingPreview';
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
import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';
import {
  Building,
  Palette,
  Image as ImageIcon,
  Phone,
  Globe,
  Eye,
  Crown,
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
    /** Source of truth for displayed/saved brand name (same as brandName on save) */
    firmName?: string | null;
    brandName?: string | null;
    tagline?: string | null;
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
  features: SubscriptionFeatures;
  currentSubdomain?: AdvisorSubdomainSettings | null;
  productionDomain: string;
  tenantSubdomainSuffix?: string;
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
  children,
}: {
  title: string;
  description: string;
  icon: LucideIcon;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-5">
      <div className="space-y-1 border-b border-border/50 pb-4">
        <h2 className="flex items-center gap-2 text-base font-semibold tracking-tight">
          <Icon className="size-4 text-muted-foreground" aria-hidden />
          {title}
        </h2>
        <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

export function EnhancedBrandingForm({
  profile,
  features,
  currentSubdomain = null,
  productionDomain,
  tenantSubdomainSuffix = '',
  platformSubdomainsAutoActivate = true,
}: EnhancedBrandingFormProps) {
  const xlSidebar = useXlSidebarNav();

  const brandNameFromFirm =
    profile.firmName?.trim() || profile.brandName?.trim() || '';

  const defaultFormValues: BrandingFormData = {
    brandName: brandNameFromFirm,
    tagline: profile.tagline || '',
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

  useEffect(() => {
    setValue('brandName', brandNameFromFirm, { shouldDirty: false, shouldValidate: false });
  }, [brandNameFromFirm, setValue]);

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
  }, [setValue]);

  // Get upgrade message for restricted features
  const getUpgradeMessage = (sectionId: string): string => {
    switch (sectionId) {
      case 'colors':
        return 'Upgrade to Growth or Professional to customize brand colors';
      case 'domain':
        return 'Upgrade to Growth or Professional to claim a custom subdomain';
      default:
        return 'This feature requires a subscription upgrade';
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
              'h-auto w-full shrink-0 gap-0 rounded-none border-border/60 bg-muted/25 p-2 text-muted-foreground',
              xlSidebar
                ? 'xl:sticky xl:top-20 xl:z-10 xl:w-[13.5rem] xl:flex-col xl:border-r xl:bg-muted/20 xl:px-2 xl:py-4'
                : 'grid w-full grid-cols-3 gap-1 border-b'
            )}
          >
              {FORM_SECTIONS.map((section) => {
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
                        : 'h-auto min-w-0 justify-center px-2 py-2'
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
                        <Crown
                          className="ml-auto size-3.5 shrink-0 !opacity-100 text-amber-600 dark:text-amber-500"
                          aria-label="Requires plan upgrade"
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
              {/* RHF only submits registered fields; ColorPickers use setValue only */}
              <input type="hidden" {...register('brandName')} />
              <input type="hidden" {...register('primaryColor')} />
              <input type="hidden" {...register('secondaryColor')} />
              <input type="hidden" {...register('accentColor')} />
              <input type="hidden" {...register('logoUrl')} />
              <TabsContent value="identity" className="mt-0 outline-none">
                <SettingsSection
                  title="Brand identity"
                  description="How clients see your firm name, tagline, and website on branded surfaces."
                  icon={Building}
                >
                  <div className="space-y-2">
                    <Label htmlFor="brandNameDisplay">Public brand name</Label>
                    <Input
                      id="brandNameDisplay"
                      value={brandNameFromFirm || '—'}
                      readOnly
                      disabled
                      className="bg-muted/40"
                    />
                    <p className="text-xs text-muted-foreground">
                      Matches your firm name from{' '}
                      <span className="font-medium text-foreground">Your profile</span> below.
                      Contact your administrator to change it.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="tagline">Tagline</Label>
                    <Textarea
                      id="tagline"
                      {...register('tagline')}
                      placeholder="Your brand tagline or mission statement"
                      maxLength={150}
                      rows={3}
                    />
                    {errors.tagline && (
                      <p className="text-sm text-destructive">{errors.tagline.message}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="websiteUrl">Website URL</Label>
                    <Input
                      id="websiteUrl"
                      type="url"
                      {...register('websiteUrl')}
                      placeholder="https://your-website.com"
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
                >
                  {!features.advancedBrandingEnabled ? (
                    <Alert>
                      <Crown className="h-4 w-4 text-amber-600" aria-hidden />
                      <AlertDescription>{getUpgradeMessage('colors')}</AlertDescription>
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
                      />
                      <ColorPicker
                        label="Secondary Color"
                        value={watchedValues.secondaryColor || ''}
                        onChange={(color) =>
                          setValue('secondaryColor', color, { shouldDirty: true })
                        }
                        error={errors.secondaryColor?.message}
                      />
                      <ColorPicker
                        label="Accent Color"
                        value={watchedValues.accentColor || ''}
                        onChange={(color) =>
                          setValue('accentColor', color, { shouldDirty: true })
                        }
                        error={errors.accentColor?.message}
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
                >
                  <FileUpload
                    accept="image/*"
                    maxSize={LOGO_MAX_BYTES}
                    onUpload={handleLogoUpload}
                    currentFile={watchedValues.logoUrl || profile.logoUrl || null}
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
                    <Label htmlFor="supportEmail">Support email</Label>
                    <Input
                      id="supportEmail"
                      type="email"
                      {...register('supportEmail')}
                      placeholder="support@yourcompany.com"
                    />
                    {errors.supportEmail && (
                      <p className="text-sm text-destructive">{errors.supportEmail.message}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="supportPhone">Support phone</Label>
                    <Input
                      id="supportPhone"
                      type="tel"
                      {...register('supportPhone')}
                      placeholder="+1 (555) 123-4567"
                    />
                    {errors.supportPhone && (
                      <p className="text-sm text-destructive">{errors.supportPhone.message}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="emailFooterText">Email footer text</Label>
                    <Textarea
                      id="emailFooterText"
                      {...register('emailFooterText')}
                      placeholder="Custom footer text for email communications"
                      maxLength={300}
                      rows={3}
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
                  platformSubdomainsAutoActivate={platformSubdomainsAutoActivate}
                />
              </TabsContent>

              <TabsContent value="preview" className="mt-0 outline-none">
                <SettingsSection
                  title="Live preview"
                  description="Email, dashboard, and PDF touchpoints with your current branding."
                  icon={Eye}
                >
                  <PreviewContainer branding={brandingForPreview} />
                </SettingsSection>
              </TabsContent>
              </div>

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
            </form>
          </Tabs>
      </div>

      {showSidebarPreview ? (
        <aside className="min-w-0 space-y-4 xl:sticky xl:top-20 xl:self-start">
          <div className="space-y-1 px-1">
            <p className="text-sm font-semibold tracking-tight">Live preview</p>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Updates as you edit. Open the Preview tab for email and PDF samples.
            </p>
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
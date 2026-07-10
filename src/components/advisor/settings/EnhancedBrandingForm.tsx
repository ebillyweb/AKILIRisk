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
import { BrandingLivePreview } from '@/components/advisor/settings/BrandingLivePreview';
import { TierFeatureLockIcon, TierFeatureUpgradeButton } from '@/components/advisor/billing/TierFeatureUpgrade';
import { SubdomainManager } from '@/components/advisor/settings/SubdomainManager';
import { Checkbox } from '@/components/ui/checkbox';
import {
  brandingUpdateSchema,
  BrandingFormData,
  LANDING_CARD_DESCRIPTION_MAX,
  LANDING_CARD_TITLE_MAX,
  LOGO_MAX_BYTES,
  SubscriptionFeatures,
  type LandingFeatureCard,
} from '@/lib/validation/branding';
import type { AdvisorSubdomainSettings } from '@/lib/advisor/subdomain';
import { updateAdvisorBrandingAction } from '@/lib/actions/advisor-branding-actions';
import { resolveAdvisorLogoSrcForPreview } from '@/lib/branding/advisor-logo-display';
import {
  resolveBrandedLandingCopy,
  resolveLandingFeatureCards,
} from '@/lib/branding/landing-copy';
import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';
import {
  Building,
  Palette,
  Image as ImageIcon,
  Phone,
  Globe,
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
    landingFeatureCards?: unknown;
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
] as const;

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

  const initialCards = useMemo(
    () => resolveLandingFeatureCards(profile.landingFeatureCards),
    [profile.landingFeatureCards],
  );
  const [cards, setCards] = useState<LandingFeatureCard[]>(initialCards);
  const [cardsDirty, setCardsDirty] = useState(false);

  const updateCard = useCallback(
    (index: number, patch: Partial<LandingFeatureCard>) => {
      setCards((prev) =>
        prev.map((card, i) => (i === index ? { ...card, ...patch } : card)),
      );
      setCardsDirty(true);
    },
    [],
  );

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
      landingFeatureCards: cards,
    }),
    [watchedValues, profile.logoUrl, cards]
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
    if (isDirty || cardsDirty) {
      setShowSavedFlash(false);
    }
  }, [isDirty, cardsDirty]);

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
      // Feature cards are local state (booleans + hideable), appended explicitly
      // so a hidden card (visible:false) isn't dropped by the truthy guard above.
      cards.forEach((card, i) => {
        formData.append(`landingCard${i}Title`, card.title);
        formData.append(`landingCard${i}Description`, card.description);
        formData.append(`landingCard${i}Visible`, String(card.visible));
      });

      const result = await updateAdvisorBrandingAction(formData);

      if (result.success) {
        toast.success('Brand updated successfully');
        reset(data);
        setCardsDirty(false);
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

  const showColorSwatches =
    features.advancedBrandingEnabled &&
    Boolean(
      watchedValues.primaryColor ||
        watchedValues.secondaryColor ||
        watchedValues.accentColor,
    );

  return (
    <div className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm">
      <BrandingLivePreview
        branding={brandingForPreview}
        readOnly={readOnly}
        isDirty={isDirty || cardsDirty}
        currentSubdomain={currentSubdomain}
        portalConfig={portalConfig}
        customSubdomainEnabled={features.customSubdomainEnabled}
        showColorSwatches={showColorSwatches}
      />

      <Tabs
        value={activeSection}
        onValueChange={setActiveSection}
        orientation={xlSidebar ? 'vertical' : 'horizontal'}
        className={cn('gap-0', xlSidebar && 'xl:flex xl:items-stretch')}
      >
        <TabsList
          variant="line"
          aria-label="Brand settings sections"
          ref={mobileTabsListRef}
          className={cn(
            'w-full shrink-0 gap-1 rounded-none border-b border-border/60 bg-muted/15 p-2 text-muted-foreground',
            xlSidebar
              ? 'xl:sticky xl:top-20 xl:z-10 xl:w-56 xl:flex-col xl:border-b-0 xl:border-r xl:bg-muted/10 xl:px-3 xl:py-5'
              : 'flex h-auto w-full overflow-x-auto',
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
                      'min-h-10 shrink-0 rounded-lg text-left text-xs font-medium sm:text-sm',
                      'data-[state=active]:border-border/60 data-[state=active]:bg-background data-[state=active]:shadow-sm',
                      xlSidebar
                        ? 'h-auto w-full flex-col items-stretch gap-1 px-3 py-2.5'
                        : 'h-9 min-w-[5.5rem] justify-center px-3',
                    )}
                  >
                    <span
                      className={cn(
                        'flex w-full items-center gap-2',
                        xlSidebar ? 'justify-start' : 'justify-center sm:justify-center'
                      )}
                    >
                      <section.icon
                        className="size-4 shrink-0"
                        aria-hidden
                      />
                      <span className="leading-tight whitespace-nowrap">
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

                  <div className="space-y-4 rounded-xl border border-border/60 bg-muted/15 p-4">
                    <div className="space-y-1">
                      <h3 className="text-sm font-semibold tracking-tight">Feature cards</h3>
                      <p className="text-xs leading-relaxed text-muted-foreground">
                        The three highlight cards under the hero. Edit the copy, or
                        hide a card to show fewer. Keep titles short so the layout
                        stays aligned.
                      </p>
                    </div>
                    {cards.map((card, index) => (
                      <div
                        key={index}
                        className="space-y-3 rounded-lg border border-border/50 bg-background/60 p-3"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-xs font-medium text-muted-foreground">
                            Card {index + 1}
                          </span>
                          <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                            <Checkbox
                              checked={card.visible}
                              onCheckedChange={(value) =>
                                updateCard(index, { visible: value === true })
                              }
                              disabled={readOnly}
                              aria-label={`Show card ${index + 1} on the portal`}
                            />
                            Show on portal
                          </label>
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <Label htmlFor={`landingCard${index}Title`}>Title</Label>
                            <span className="text-[11px] tabular-nums text-muted-foreground">
                              {card.title.length}/{LANDING_CARD_TITLE_MAX}
                            </span>
                          </div>
                          <Input
                            id={`landingCard${index}Title`}
                            value={card.title}
                            onChange={(e) =>
                              updateCard(index, { title: e.target.value })
                            }
                            maxLength={LANDING_CARD_TITLE_MAX}
                            readOnly={readOnly}
                            disabled={readOnly}
                            className={readOnly ? 'bg-muted/40' : undefined}
                          />
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <Label htmlFor={`landingCard${index}Description`}>
                              Description
                            </Label>
                            <span className="text-[11px] tabular-nums text-muted-foreground">
                              {card.description.length}/{LANDING_CARD_DESCRIPTION_MAX}
                            </span>
                          </div>
                          <Textarea
                            id={`landingCard${index}Description`}
                            value={card.description}
                            onChange={(e) =>
                              updateCard(index, { description: e.target.value })
                            }
                            maxLength={LANDING_CARD_DESCRIPTION_MAX}
                            rows={2}
                            readOnly={readOnly}
                            disabled={readOnly}
                            className={readOnly ? 'bg-muted/40' : undefined}
                          />
                        </div>
                      </div>
                    ))}
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
              </div>

              {!readOnly ? (
              <div className="sticky bottom-0 z-10 space-y-3 border-t border-border/60 bg-card/95 px-4 py-4 backdrop-blur-sm sm:px-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch sm:gap-3">
                  <Button
                    type="submit"
                    disabled={(!isDirty && !cardsDirty) || isSubmitting}
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
                    onClick={() => {
                      reset();
                      setCards(initialCards);
                      setCardsDirty(false);
                    }}
                    disabled={(!isDirty && !cardsDirty) || isSubmitting}
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
  );
}
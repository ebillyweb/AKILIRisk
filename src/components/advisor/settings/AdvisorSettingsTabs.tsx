"use client";

import Link from "next/link";
import { useCallback, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { EnhancedBrandingForm } from "@/components/advisor/settings/EnhancedBrandingForm";
import { HouseholdProfilesPolicyForm } from "@/components/advisor/settings/HouseholdProfilesPolicyForm";
import { AdvisorPersonalDetailsForm } from "@/components/settings/AdvisorPersonalDetailsForm";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { AdvisorSubdomainSettings } from "@/lib/advisor/subdomain";
import {
  parseAdvisorSettingsTab,
  type AdvisorSettingsTab,
} from "@/lib/advisor/settings-tabs";
import type { SubscriptionFeatures } from "@/lib/validation/branding";

export type { AdvisorSettingsTab };
export { parseAdvisorSettingsTab };

const ADVISOR_SETTINGS_TABS: AdvisorSettingsTab[] = ["general", "branding", "security"];

type ProfileInitialData = {
  firstName: string;
  lastName: string;
  phone: string;
  jobTitle: string;
  firmName: string;
  licenseNumber: string;
  email: string;
};

type BrandingProfile = Parameters<typeof EnhancedBrandingForm>[0]["profile"];

interface AdvisorSettingsTabsProps {
  initialTab: AdvisorSettingsTab;
  profileInitialData: ProfileInitialData;
  firmNameReadOnly: boolean;
  brandingProfile: BrandingProfile;
  brandingReadOnly: boolean;
  brandingReadOnlyNotice?: string;
  subdomainReadOnly?: boolean;
  features: SubscriptionFeatures;
  currentSubdomain: AdvisorSubdomainSettings | null;
  productionDomain: string;
  tenantSubdomainSuffix: string;
  useTenantPathPortals: boolean;
  platformAppOrigin: string;
  stagingPlatformHost: string;
  platformSubdomainsAutoActivate: boolean;
  passwordChangeRequired: boolean;
  changePasswordHref: string;
  householdProfilesEnabled: boolean;
  showBrandingTab?: boolean;
}

export function AdvisorSettingsTabs({
  initialTab,
  profileInitialData,
  firmNameReadOnly,
  brandingProfile,
  brandingReadOnly,
  brandingReadOnlyNotice,
  subdomainReadOnly = false,
  features,
  currentSubdomain,
  productionDomain,
  tenantSubdomainSuffix,
  useTenantPathPortals,
  platformAppOrigin,
  stagingPlatformHost,
  platformSubdomainsAutoActivate,
  passwordChangeRequired,
  changePasswordHref,
  householdProfilesEnabled,
  showBrandingTab = true,
}: AdvisorSettingsTabsProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeTab = parseAdvisorSettingsTab(searchParams.get("tab") ?? initialTab, {
    brandingTabVisible: showBrandingTab,
  });

  useEffect(() => {
    if (!showBrandingTab && searchParams.get("tab") === "branding") {
      const params = new URLSearchParams(searchParams.toString());
      params.delete("tab");
      const query = params.toString();
      router.replace(query ? `/advisor/settings?${query}` : "/advisor/settings", {
        scroll: false,
      });
    }
  }, [router, searchParams, showBrandingTab]);

  const setTab = useCallback(
    (tab: AdvisorSettingsTab) => {
      const params = new URLSearchParams(searchParams.toString());
      if (tab === "general") {
        params.delete("tab");
      } else {
        params.set("tab", tab);
      }
      const query = params.toString();
      router.replace(query ? `/advisor/settings?${query}` : "/advisor/settings", {
        scroll: false,
      });
    },
    [router, searchParams],
  );

  return (
    <Tabs
      value={activeTab}
      onValueChange={(value) => {
        if (ADVISOR_SETTINGS_TABS.includes(value as AdvisorSettingsTab)) {
          setTab(value as AdvisorSettingsTab);
        }
      }}
      className="gap-6"
    >
      <TabsList
        variant="line"
        className="h-auto w-full justify-start gap-1 border-b border-border/60 pb-0"
        data-tour="config-settings-tabs"
      >
        <TabsTrigger value="general" className="rounded-none px-3 pb-3">
          General
        </TabsTrigger>
        {showBrandingTab ? (
          <TabsTrigger
            value="branding"
            className="rounded-none px-3 pb-3"
            data-tour="config-branding-tab"
          >
            Branding
          </TabsTrigger>
        ) : null}
        <TabsTrigger value="security" className="gap-2 rounded-none px-3 pb-3">
          Security
          {passwordChangeRequired ? (
            <Badge variant="warning" className="text-[10px] leading-none">
              Action required
            </Badge>
          ) : null}
        </TabsTrigger>
      </TabsList>

      <TabsContent value="general" className="mt-0 space-y-6 outline-none">
        <div className="rounded-xl border border-border/70 bg-card p-6 shadow-sm">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold tracking-tight">Your profile</h2>
            <p className="text-sm text-muted-foreground">
              Your name and firm as shown in client invitation emails. Email changes require
              your administrator.
            </p>
          </div>
          <div className="mt-6">
            <AdvisorPersonalDetailsForm
              initialData={profileInitialData}
              firmNameReadOnly={firmNameReadOnly}
            />
          </div>
        </div>

        <div className="space-y-4 rounded-xl border bg-card p-6 shadow-sm">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold tracking-tight">Household profiles</h2>
            <p className="text-sm text-muted-foreground">
              Control whether clients can manage household members and receive personalized
              assessment copy.
            </p>
          </div>
          <HouseholdProfilesPolicyForm initialEnabled={householdProfilesEnabled} />
        </div>
      </TabsContent>

      <TabsContent value="branding" className="mt-0 outline-none">
        {showBrandingTab ? (
          <div data-tour="config-primary-form">
            <EnhancedBrandingForm
            profile={brandingProfile}
            readOnly={brandingReadOnly}
            readOnlyNotice={brandingReadOnlyNotice}
            subdomainReadOnly={subdomainReadOnly}
            features={features}
            currentSubdomain={currentSubdomain}
            productionDomain={productionDomain}
            tenantSubdomainSuffix={tenantSubdomainSuffix}
            useTenantPathPortals={useTenantPathPortals}
            platformAppOrigin={platformAppOrigin}
            stagingPlatformHost={stagingPlatformHost}
            platformSubdomainsAutoActivate={platformSubdomainsAutoActivate}
          />
          </div>
        ) : null}
      </TabsContent>

      <TabsContent value="security" className="mt-0 space-y-6 outline-none">
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-semibold tracking-tight">Account security</h2>
                {passwordChangeRequired ? (
                  <Badge variant="warning">Password update required</Badge>
                ) : null}
              </div>
              <p className="text-sm text-muted-foreground">
                You sign in with your email and password. Update your password here to match the
                current platform security policy.
              </p>
            </div>
            <Button asChild variant="outline" size="sm" className="shrink-0">
              <Link href={changePasswordHref}>Change password</Link>
            </Button>
          </div>
        </div>

        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <h2 className="text-lg font-semibold tracking-tight">PII policy</h2>
              <p className="text-sm text-muted-foreground">
                Configure which optional PII fields your future clients are asked for during
                intake.
              </p>
            </div>
            <Button asChild variant="outline" size="sm" className="shrink-0">
              <Link href="/advisor/settings/pii-policy">Manage policy</Link>
            </Button>
          </div>
        </div>
      </TabsContent>
    </Tabs>
  );
}

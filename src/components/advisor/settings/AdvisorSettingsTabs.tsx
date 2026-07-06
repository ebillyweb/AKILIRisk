"use client";

import Link from "next/link";
import { useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { HouseholdProfilesPolicyForm } from "@/components/advisor/settings/HouseholdProfilesPolicyForm";
import { AdvisorPersonalDetailsForm } from "@/components/settings/AdvisorPersonalDetailsForm";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  parseAdvisorSettingsTab,
  type AdvisorSettingsTab,
} from "@/lib/advisor/settings-tabs";

export type { AdvisorSettingsTab };
export { parseAdvisorSettingsTab };

const ADVISOR_SETTINGS_TABS: AdvisorSettingsTab[] = ["general", "security"];

type ProfileInitialData = {
  firstName: string;
  lastName: string;
  phone: string;
  jobTitle: string;
  firmName: string;
  licenseNumber: string;
  email: string;
};

interface AdvisorSettingsTabsProps {
  initialTab: AdvisorSettingsTab;
  profileInitialData: ProfileInitialData;
  firmNameReadOnly: boolean;
  passwordChangeRequired: boolean;
  changePasswordHref: string;
  householdProfilesEnabled: boolean;
  showHouseholdProfilesPolicy?: boolean;
}

export function AdvisorSettingsTabs({
  initialTab,
  profileInitialData,
  firmNameReadOnly,
  passwordChangeRequired,
  changePasswordHref,
  householdProfilesEnabled,
  showHouseholdProfilesPolicy = true,
}: AdvisorSettingsTabsProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeTab = parseAdvisorSettingsTab(searchParams.get("tab") ?? initialTab);

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

        {showHouseholdProfilesPolicy ? (
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
        ) : (
          <div className="rounded-xl border bg-card p-6 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1">
                <h2 className="text-lg font-semibold tracking-tight">Household profiles</h2>
                <p className="text-sm text-muted-foreground">
              Firm owners and administrators manage household profiles under Firm → Access
              control.
                </p>
              </div>
              <Button asChild variant="outline" size="sm" className="shrink-0">
                <Link href="/advisor/settings/access-control">Roles & Permissions</Link>
              </Button>
            </div>
          </div>
        )}
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
              <h2 className="text-lg font-semibold tracking-tight">Client data policy</h2>
              <p className="text-sm text-muted-foreground">
                Workspace labeling (email vs Client reference) and optional intake
                fields. Firm defaults live under Firm → Roles & Permissions.
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

import { getAdvisorDashboardData } from "@/lib/actions/advisor-actions";
import { getAdvisorSubdomainSettings } from "@/lib/advisor/subdomain";
import {
  getSubscriptionFeatures,
  STARTER_SUBSCRIPTION_FEATURES,
} from "@/lib/subscription/validation";
import { EnhancedBrandingForm } from "@/components/advisor/settings/EnhancedBrandingForm";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default async function AdvisorSettingsPage() {
  const result = await getAdvisorDashboardData();

  if (!result.success) {
    return (
      <div className="space-y-6">
        <div className="text-center py-12">
          <p className="text-destructive text-sm">
            Error loading settings: {result.error}
          </p>
        </div>
      </div>
    );
  }

  const { profile } = result.data!;

  const currentSubdomain = await getAdvisorSubdomainSettings(profile.id);

  // Subscription flags gate premium tabs; missing Subscription row should not hide the full branding UI
  const features =
    (await getSubscriptionFeatures(profile.userId)) ?? STARTER_SUBSCRIPTION_FEATURES;

  const displayName =
    profile.user.firstName && profile.user.lastName
      ? `${profile.user.firstName} ${profile.user.lastName}`
      : profile.user.name || "—";

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
     

        <Badge
          variant={features.tier === 'PROFESSIONAL' ? 'default' : 'secondary'}
          className="w-fit shrink-0 px-3 py-1 text-xs font-semibold uppercase tracking-wide"
        >
          {features.tier} plan
        </Badge>
      </div>

      <div className="space-y-6">
        {/* Branding Section (page title: sr-only "Settings" in advisor layout) */}
        <EnhancedBrandingForm
          profile={{
            firmName: profile.firmName,
            brandName: profile.brandName,
            tagline: profile.tagline,
            primaryColor: profile.primaryColor,
            secondaryColor: profile.secondaryColor,
            accentColor: profile.accentColor,
            websiteUrl: profile.websiteUrl,
            emailFooterText: profile.emailFooterText,
            supportEmail: profile.supportEmail,
            supportPhone: profile.supportPhone,
            logoUrl: profile.logoUrl,
            logoS3Key: profile.logoS3Key,
            logoContentType: profile.logoContentType,
            logoFileSize: profile.logoFileSize,
            logoUploadedAt: profile.logoUploadedAt,
          }}
          features={features}
          currentSubdomain={currentSubdomain}
        />

        {/* Advisor profile (admin-managed; distinct from client-facing support contacts in branding) */}
        <div className="rounded-xl border border-border/70 bg-card p-6 shadow-sm">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold tracking-tight">Your profile</h2>
            <p className="text-sm text-muted-foreground">
              Your name and firm as shown in client invitation emails. Updated by your
              administrator.
            </p>
          </div>
          <dl className="mt-6 grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Name</dt>
              <dd className="mt-1 text-sm">{displayName}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Email</dt>
              <dd className="mt-1 text-sm">{profile.user.email}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Phone</dt>
              <dd className="mt-1 text-sm">{profile.phone || "—"}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Firm</dt>
              <dd className="mt-1 text-sm">{profile.firmName || "—"}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Job title</dt>
              <dd className="mt-1 text-sm">{profile.jobTitle || "—"}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">License</dt>
              <dd className="mt-1 text-sm">{profile.licenseNumber || "—"}</dd>
            </div>
          </dl>
          <p className="mt-5 border-t pt-4 text-xs text-muted-foreground">
            To change this information, contact your administrator.
          </p>
        </div>

        {/* Option D session 1: PII policy navigation card. Links to the
            sub-route at /advisor/settings/pii-policy. Mirrors the
            existing pattern where /advisor/settings/notifications is
            linked from outside this page (it's reachable but the main
            settings page doesn't currently surface it inline). */}
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <h2 className="text-lg font-semibold tracking-tight">PII policy</h2>
              <p className="text-sm text-muted-foreground">
                Configure which optional PII fields your future clients are
                asked for during intake.
              </p>
            </div>
            <Button asChild variant="outline" size="sm" className="shrink-0">
              <Link href="/advisor/settings/pii-policy">Manage policy</Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
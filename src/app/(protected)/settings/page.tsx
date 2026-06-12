import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import Link from "next/link";
import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AdvisorPersonalDetailsForm } from "@/components/settings/AdvisorPersonalDetailsForm";
import { ClientPersonalDetailsForm } from "@/components/settings/ClientPersonalDetailsForm";
import { ClientPiiConsentForm } from "@/components/settings/ClientPiiConsentForm";
import { ClientOptionalPiiForm } from "@/components/settings/ClientOptionalPiiForm";
import { getAdvisorPersonalDetails, getClientPersonalDetails } from "@/lib/actions/personal-profile";
import { listClientConsentPreferences } from "@/lib/advisor/client-consent-settings";
import {
  getClientOptionalPiiSettings,
  settingsOffersOptionalPii,
} from "@/lib/advisor/client-optional-pii-settings";
import { decryptUserEmail } from "@/lib/auth/user-email";
import { isAdvisorHubNavRole } from "@/lib/auth-roles";
import { buildSignInHref } from "@/lib/auth/sign-in-routes";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string }>;
}) {
  const session = await auth();
  const { notice } = await searchParams;
  const advisorPortalDisabled = notice === "advisor_portal_disabled";
  const advisorSubscriptionRequired = notice === "advisor_subscription_required";

  if (!session?.user?.id) {
    redirect(buildSignInHref({ callbackUrl: "/settings" }));
  }

  const role = session.user.role?.toString().toUpperCase();

  // Round-11 commit 2.4b: ciphertext + decrypt for display.
  const userRow = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      emailCiphertext: true,
      mfaEnabled: true,
      mfaRecoveryCodes: true,
    },
  });

  if (!userRow) {
    redirect(buildSignInHref({ callbackUrl: "/settings" }));
  }
  const user = { ...userRow, email: decryptUserEmail(userRow.emailCiphertext) };

  // Fetch personal details for profile section (advisor or client by role)
  let advisorDetails: Awaited<ReturnType<typeof getAdvisorPersonalDetails>>["data"] = null;
  let clientDetails: Awaited<ReturnType<typeof getClientPersonalDetails>>["data"] = null;
  let clientConsentAssignments: Awaited<
    ReturnType<typeof listClientConsentPreferences>
  > = [];
  let clientOptionalPii: Awaited<
    ReturnType<typeof getClientOptionalPiiSettings>
  > = null;
  if (isAdvisorHubNavRole(role)) {
    const res = await getAdvisorPersonalDetails();
    if (res.success && res.data) advisorDetails = res.data;
  }
  if (role === "USER") {
    const [res, consent, optionalPii] = await Promise.all([
      getClientPersonalDetails(),
      listClientConsentPreferences(session.user.id),
      getClientOptionalPiiSettings(session.user.id),
    ]);
    if (res.success && res.data) clientDetails = res.data;
    clientConsentAssignments = consent;
    clientOptionalPii = optionalPii;
  }

  const recoveryCodesRemaining = user.mfaRecoveryCodes
    ? (user.mfaRecoveryCodes as string[]).length
    : 0;

  const showMfaSettings = isAdvisorHubNavRole(role);

  return (
    <div className="mx-auto max-w-5xl space-y-6 sm:space-y-8">
      {advisorPortalDisabled ? (
        <Alert variant="warning">
          <AlertCircle className="size-4" />
          <AlertTitle>Advisor hub unavailable</AlertTitle>
          <AlertDescription>
            Your advisor portal access has been turned off for this account. You can still use
            Settings and other non-advisor areas. If this is unexpected, contact your platform
            administrator.
          </AlertDescription>
        </Alert>
      ) : null}
      {advisorSubscriptionRequired ? (
        <Alert variant="warning">
          <AlertCircle className="size-4" />
          <AlertTitle>Subscription required</AlertTitle>
          <AlertDescription>
            The advisor hub is only available with an active subscription linked to your account
            (and Stripe checkout when billing is enabled). Complete checkout if your administrator
            has sent you a billing link, or contact them to enable access after you are subscribed.
          </AlertDescription>
        </Alert>
      ) : null}
      <section className="hero-surface rounded-[1.75rem] p-4 sm:p-8">
        <Card className="bg-background/60 max-w-xl">
            <CardContent className={`grid gap-3 pt-5 sm:pt-6 ${showMfaSettings ? "sm:grid-cols-2" : ""}`}>
              <div>
                <p className="editorial-kicker">Email</p>
                <p className="mt-2 text-lg font-semibold break-all">{user.email}</p>
              </div>
              {showMfaSettings ? (
                <div>
                  <p className="editorial-kicker">MFA Status</p>
                  <p className="mt-2 text-lg font-semibold">
                    {user.mfaEnabled ? "Enabled" : "Not Enabled"}
                  </p>
                </div>
              ) : null}
            </CardContent>
          </Card>
      </section>

      <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
        <Card>
          <CardHeader>
            <CardTitle className="text-3xl">Account Information</CardTitle>
            <CardDescription>
              Primary identity details for your assessment workspace.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-[1.25rem] border section-divider bg-background/55 px-4 py-4">
              <p className="editorial-kicker">Email Address</p>
              <p className="mt-2 text-base font-semibold">{user.email}</p>
            </div>
          </CardContent>
        </Card>

        {(advisorDetails !== null || clientDetails !== null) && (
          <Card>
            <CardHeader>
              <CardTitle className="text-3xl">Personal details</CardTitle>
              <CardDescription>
                {advisorDetails !== null
                  ? "Contact and professional details for your advisor profile."
                  : "Contact and address details visible to your advisor."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {advisorDetails !== null && (
                <AdvisorPersonalDetailsForm
                  initialData={{ ...advisorDetails, email: user.email }}
                />
              )}
              {clientDetails !== null && (
                <ClientPersonalDetailsForm initialData={clientDetails} />
              )}
            </CardContent>
          </Card>
        )}

        {settingsOffersOptionalPii(clientOptionalPii) ? (
          <ClientOptionalPiiForm initialData={clientOptionalPii} />
        ) : null}

        {clientConsentAssignments.length > 0 ? (
          <ClientPiiConsentForm assignments={clientConsentAssignments} />
        ) : null}

        {showMfaSettings ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-3xl">Two-Factor Authentication</CardTitle>
            <CardDescription>
              Strengthen sign-in security with a second verification factor.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {user.mfaEnabled ? (
              <>
                <div className="flex flex-col gap-3 rounded-[1.25rem] border section-divider bg-background/55 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="editorial-kicker">Protection Status</p>
                    <p className="mt-2 text-base font-semibold">MFA is active on this account</p>
                  </div>
                  <Badge variant="success">Protected</Badge>
                </div>

                <div className="rounded-[1.25rem] border section-divider bg-background/55 px-4 py-4">
                  <p className="editorial-kicker">Recovery Codes</p>
                  <p className="mt-2 text-base font-semibold">
                    {recoveryCodesRemaining} recovery code
                    {recoveryCodesRemaining !== 1 ? "s" : ""} remaining
                  </p>
                  {recoveryCodesRemaining <= 2 ? (
                    <p className="mt-3 text-sm leading-6 text-amber-700 dark:text-amber-300">
                      You&apos;re running low on recovery codes. Regeneration and disable controls are not yet implemented.
                    </p>
                  ) : (
                    <p className="mt-3 text-sm leading-6 text-muted-foreground">
                      Your saved recovery codes provide secure fallback access if your authenticator is unavailable.
                    </p>
                  )}
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-[1.25rem] border section-divider bg-background/55 px-4 py-4">
                    <p className="editorial-kicker">Planned Control</p>
                    <p className="mt-2 text-sm font-semibold">Regenerate recovery codes</p>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      This control is planned for a future iteration and is not yet available.
                    </p>
                  </div>
                  <div className="rounded-[1.25rem] border section-divider bg-background/55 px-4 py-4">
                    <p className="editorial-kicker">Planned Control</p>
                    <p className="mt-2 text-sm font-semibold">Disable MFA</p>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      Direct MFA deactivation has not been implemented yet.
                    </p>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="flex flex-col gap-3 rounded-[1.25rem] border section-divider bg-background/55 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="editorial-kicker">Protection Status</p>
                    <p className="mt-2 text-base font-semibold">MFA is not enabled</p>
                  </div>
                  <Badge variant="secondary">Recommended</Badge>
                </div>

                <div className="rounded-[1.25rem] border border-brand/25 bg-brand/10 px-4 py-4">
                  <p className="text-sm leading-6 text-foreground">
                    Enable two-factor authentication to add a second layer of protection.
                    You&apos;ll need an authenticator app such as Google Authenticator,
                    Authy, or 1Password.
                  </p>
                </div>

                <Button asChild size="lg" className="w-full sm:w-auto">
                  <Link href="/mfa/setup">Enable Two-Factor Authentication</Link>
                </Button>
              </>
            )}
          </CardContent>
        </Card>
        ) : null}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-3xl">Security Actions</CardTitle>
          <CardDescription>
            Additional account controls will expand here as the workspace evolves.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {showMfaSettings ? (
            <div className="rounded-[1.25rem] border section-divider bg-background/55 px-4 py-4">
              <p className="editorial-kicker">Password</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Update your sign-in password to match the current platform policy.
              </p>
              <Button asChild variant="outline" size="sm" className="mt-4">
                <Link href="/change-password">Change password</Link>
              </Button>
            </div>
          ) : (
            <div className="rounded-[1.25rem] border section-divider bg-background/55 px-4 py-4">
              <p className="editorial-kicker">Planned Control</p>
              <p className="mt-2 text-sm font-semibold">Change Password</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Client accounts sign in with email links and do not use passwords.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

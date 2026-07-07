import Link from "next/link";
import type { Metadata } from "next";
import { auth, signOut } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ProtectedNav } from "@/components/layout/ProtectedNav";
import { ClientPageHeaderSlot } from "@/components/layout/ClientPageHeaderSlot";
import { ClientPortalBrandedHeaderMark } from "@/components/layout/ClientPortalBrandedHeaderMark";
import { RedirectIncompleteIntake } from "@/components/layout/RedirectIncompleteIntake";
import { BrandingProvider } from "@/components/providers/BrandingProvider";
import { AkiliHeaderLockup } from "@/components/home/AkiliLogoLockup";
import { BrandingUnavailable } from "@/components/branding/BrandingUnavailable";
import { BrandedPortalFooter } from "@/components/branding/BrandedPortalFooter";
import { ClientPortalRootTheme } from "@/components/branding/ClientPortalRootTheme";
import { clientPortalBrandingDisplayTitle, clientPortalLogoImgSrc } from "@/lib/client/client-portal-branding";
import { buildClientPortalMetadata } from "@/lib/client/client-portal-metadata";
import { resolveClientPortalBrandingForUser } from "@/lib/client/resolve-client-portal-branding";
import { clientExpectsBrandedPortal, getTenantSubdomainFromHeaders, isTenantBrandedRequest } from "@/lib/client/branded-portal-requirements";
import { getClientIntakeGateState } from "@/lib/client/intake-gate";
import { getClientHouseholdProfilesEnabled } from "@/lib/household/profiles-policy";
import { isClientDocumentRequirementsEnabledForUser } from "@/lib/client/client-document-requirements-visibility.server";
import { getClientPortalSignedInLabel } from "@/lib/client/client-portal-identity.server";
import { getTenantPathPrefixFromHeaders } from "@/lib/client/tenant-path-prefix";
import { getPreviewBrandHex } from "@/lib/branding/preview-hex";
import { getPlatformFeatureFlags } from "@/lib/platform/feature-flags";
import { prisma } from "@/lib/db";
import {
  isAdvisorHubNavRole,
  isPlatformAdminRole,
} from "@/lib/auth-roles";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { TenantPublicThemeLock } from "@/components/theme/TenantPublicThemeLock";
import { WorkspaceSlimHeader } from "@/components/layout/WorkspaceSlimHeader";
import { redirectIfMfaChallengePending } from "@/lib/auth/require-mfa-verified";
import { buildSignInHref } from "@/lib/auth/sign-in-routes";
import { redirectIfPendingConsent } from "@/lib/advisor/require-consent-resolved";
import { getClientPageHeaderConfig } from "@/components/layout/client-page-header-config";
import { SessionSync } from "@/components/auth/SessionSync";

/** Shown above the workspace title when the client portal is advisor-branded (not the advisor tagline field). */
const BRANDED_CLIENT_HEADER_KICKER = "Brought to you by AKILI Risk Intelligence";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const session = await auth();
  if (!session?.user?.id) {
    return {};
  }

  const role = session.user.role?.toString().toUpperCase();
  if (role !== "USER") {
    return {};
  }

  const headersList = await headers();
  const pathname = headersList.get("x-akili-pathname") ?? "";
  const pageConfig = getClientPageHeaderConfig(pathname);

  const [branding, onTenantHost] = await Promise.all([
    resolveClientPortalBrandingForUser({
      userId: session.user.id,
      email: session.user.email ?? "",
    }),
    isTenantBrandedRequest(),
  ]);

  if (!branding) {
    return {};
  }

  return buildClientPortalMetadata(branding, {
    onTenantHost,
    pageTitle: pageConfig?.title ?? null,
  });
}

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    const pathname =
      (await headers()).get("x-akili-pathname") ?? "/dashboard";
    redirect(buildSignInHref({ callbackUrl: pathname }));
  }

  await redirectIfMfaChallengePending(session);

  const role = session?.user?.role?.toString().toUpperCase();
  if (role === "USER" && session.user.id) {
    await redirectIfPendingConsent(session.user.id);
  }

  if (session.user.id) {
    const userRow = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { deletedAt: true },
    });
    if (userRow?.deletedAt) {
      redirect(
        `/api/auth/signout?callbackUrl=${encodeURIComponent("/signin?notice=account_deactivated")}`
      );
    }
  }

  const showAdvisor = isAdvisorHubNavRole(role);
  const showAdmin = isPlatformAdminRole(role);

  let restrictNavToIntake = false;
  let assessmentUnlockedForClient = false;
  let clientIntakeWaived = false;
  let hideProfilesNav = false;
  let hideDocumentsNav = false;
  let hideIntakeNav = false;
  let clientAdvisorBranding: Awaited<
    ReturnType<typeof resolveClientPortalBrandingForUser>
  > = null;
  let clientPortalSubdomain: string | null = null;
  let requiresBrandedPortal = false;
  let clientPortalSignedInLabel: string | null = null;

  if (role === "USER" && session.user.id) {
    const [
      gate,
      portalBranding,
      householdProfilesEnabled,
      documentRequirementsEnabled,
      expectsBranded,
      tenantSubdomain,
      signedInLabel,
    ] =
      await Promise.all([
        getClientIntakeGateState(session.user.id),
        resolveClientPortalBrandingForUser({
          userId: session.user.id,
          email: session.user.email ?? "",
        }),
        getClientHouseholdProfilesEnabled(session.user.id),
        isClientDocumentRequirementsEnabledForUser(session.user.id),
        clientExpectsBrandedPortal({
          userId: session.user.id,
          email: session.user.email ?? "",
        }),
        getTenantSubdomainFromHeaders(),
        getClientPortalSignedInLabel({
          clientUserId: session.user.id,
          clientEmail: session.user.email ?? "",
        }),
      ]);
    clientAdvisorBranding = portalBranding;
    requiresBrandedPortal = expectsBranded;
    clientPortalSubdomain = tenantSubdomain;
    clientPortalSignedInLabel = signedInLabel;
    restrictNavToIntake = gate.restrictNavToIntake;
    assessmentUnlockedForClient = gate.assessmentUnlocked;
    clientIntakeWaived = gate.intakeWaived;
    hideProfilesNav = !householdProfilesEnabled;
    hideDocumentsNav = !documentRequirementsEnabled;
    hideIntakeNav = gate.intakeWaived;
  }

  if (role === "USER" && requiresBrandedPortal && !clientAdvisorBranding) {
    return (
      <div className="min-h-screen py-3 sm:py-6">
        <div className="page-shell">
          <BrandingUnavailable audience="client" />
        </div>
      </div>
    );
  }

  const brandTitle = clientAdvisorBranding
    ? clientPortalBrandingDisplayTitle(clientAdvisorBranding)
    : "Partner portal";
  const previewHex = clientAdvisorBranding
    ? getPreviewBrandHex(clientAdvisorBranding)
    : null;

  const compactWorkspaceHeader = showAdvisor && !clientAdvisorBranding;

  const pathname = (await headers()).get("x-akili-pathname") ?? "";
  const tenantPathPrefix = await getTenantPathPrefixFromHeaders();
  const onTenantHost = await isTenantBrandedRequest();
  const isWhiteLabeledPortal = onTenantHost || Boolean(clientAdvisorBranding);
  const isAdvisorWorkspaceRoute =
    showAdvisor && !clientAdvisorBranding && pathname.startsWith("/advisor");
  const isAdminWorkspaceRoute = showAdmin && pathname.startsWith("/admin");
  const isWorkspaceSlimHeaderRoute = isAdvisorWorkspaceRoute || isAdminWorkspaceRoute;

  const advisorFeatureFlags = showAdvisor ? await getPlatformFeatureFlags() : null;
  const clientSignedInIdentity =
    role === "USER" ? (clientPortalSignedInLabel ?? session.user.email ?? "") : null;
  const showClientBrandedFooter =
    role === "USER" && !!clientAdvisorBranding && !isWorkspaceSlimHeaderRoute;

  const shell = (
    <>
      {isWhiteLabeledPortal ? <TenantPublicThemeLock /> : null}
      {session.user.id ? <SessionSync userId={session.user.id} /> : null}
      <div className="min-h-screen py-3 sm:py-6">
      {restrictNavToIntake && (
        <RedirectIncompleteIntake restrictNavToIntake={restrictNavToIntake} />
      )}
      <div className="page-shell">
        <div
          className={cn(
            "hero-surface overflow-x-hidden rounded-[2rem]",
            previewHex && "branded-portal-shell",
          )}
          style={
            previewHex
              ? ({
                  "--branded-portal-shell-bg": previewHex.secondary,
                  "--client-brand-primary": previewHex.primary,
                } as React.CSSProperties)
              : undefined
          }
        >
          <header
            className={cn(
              "border-b section-divider overflow-visible",
              !previewHex && "bg-background/55",
              previewHex && "branded-portal-nav-header",
            )}
          >
            <div
              className={cn(
                "pl-0 pr-4 sm:pl-4 sm:pr-8 lg:pl-6 lg:pr-10",
                isWorkspaceSlimHeaderRoute ? "py-2 sm:py-3" : "py-3 sm:py-4"
              )}
            >
              {isWorkspaceSlimHeaderRoute ? (
                <WorkspaceSlimHeader
                  homeHref={isAdminWorkspaceRoute ? "/admin" : "/advisor"}
                  homeAriaLabel={
                    isAdminWorkspaceRoute ? "Admin workspace home" : "Advisor workspace home"
                  }
                  userEmail={session.user.email ?? undefined}
                />
              ) : (
                <div className="flex flex-col gap-6">
                  <div className="flex flex-col gap-5 xl:grid xl:grid-cols-[minmax(0,1fr)_auto] xl:items-end xl:gap-8">
                    <div className="min-w-0">
                      {clientAdvisorBranding ? (
                        <ClientPortalBrandedHeaderMark
                          brandTitle={brandTitle}
                          logoSrc={clientPortalLogoImgSrc(clientAdvisorBranding)}
                          primaryHex={previewHex?.primary}
                        />
                      ) : (
                        <Link
                          href="/"
                          className="inline-flex shrink-0 leading-none text-foreground transition-opacity duration-200 hover:opacity-80"
                          aria-label="AKILI home"
                        >
                          <AkiliHeaderLockup height={40} />
                        </Link>
                      )}

                      <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
                        {previewHex ? (
                          <p className="text-sm">
                            <span
                              style={{
                                color: previewHex.primary,
                                opacity: 0.72,
                              }}
                            >
                              Signed in as{" "}
                            </span>
                            <span
                              className="font-semibold break-all"
                              style={{ color: previewHex.primary }}
                            >
                              {clientSignedInIdentity}
                            </span>
                          </p>
                        ) : (
                          <p className="text-sm text-muted-foreground">
                            Signed in as{" "}
                            <span className="font-semibold text-foreground break-all">
                              {clientSignedInIdentity}
                            </span>
                          </p>
                        )}
                        <div className="flex flex-wrap items-center gap-3">
                          <ThemeToggle
                            className="shrink-0"
                            style={
                              previewHex
                                ? {
                                    borderColor: `${previewHex.primary}55`,
                                    color: previewHex.primary,
                                  }
                                : undefined
                            }
                          />
                          <form
                            action={async () => {
                              "use server";
                              await signOut({ redirectTo: "/" });
                            }}
                          >
                            <Button
                              type="submit"
                              variant="outline"
                              size="sm"
                              className="min-w-[110px] px-4"
                              style={
                                previewHex
                                  ? {
                                      borderColor: `${previewHex.primary}55`,
                                      color: previewHex.primary,
                                    }
                                  : undefined
                              }
                            >
                              Sign Out
                            </Button>
                          </form>
                        </div>
                      </div>
                    </div>
                    <div className="min-w-0 xl:max-w-[560px] xl:text-right">
                      <p
                        className={cn(
                          "mb-1",
                          compactWorkspaceHeader
                            ? "text-xs font-medium uppercase tracking-wide text-muted-foreground"
                            : "editorial-kicker",
                        )}
                        style={
                          previewHex ? { color: previewHex.primary } : undefined
                        }
                      >
                        {clientAdvisorBranding
                          ? BRANDED_CLIENT_HEADER_KICKER
                          : "AKILI Risk Intelligence"}
                      </p>
                      <h1
                        className={cn(
                          compactWorkspaceHeader
                            ? "text-xl font-semibold tracking-tight sm:text-2xl"
                            : "text-2xl font-semibold leading-[0.94] tracking-[-0.05em] sm:text-3xl lg:text-[3.25rem]",
                        )}
                        style={
                          previewHex ? { color: previewHex.primary } : undefined
                        }
                      >
                        Client Workspace
                      </h1>
                    </div>
                  </div>

                  <div
                    className="mt-3 border-t border-border/60 pt-4"
                    style={
                      previewHex
                        ? { borderTopColor: `${previewHex.primary}30` }
                        : undefined
                    }
                  >
                    <ProtectedNav
                      showAdvisor={showAdvisor}
                      showAdmin={showAdmin}
                      restrictNavToIntake={restrictNavToIntake}
                      assessmentUnlockedForClient={assessmentUnlockedForClient}
                      hideProfilesNav={hideProfilesNav}
                      hideDocumentsNav={hideDocumentsNav}
                      hideIntakeNav={hideIntakeNav}
                      clientBrandHex={previewHex}
                      advisorFeatureFlags={advisorFeatureFlags}
                    />
                  </div>
                </div>
              )}
            </div>
          </header>

          <main
            id="main-content"
            className={cn(
              "px-4 lg:px-10",
              isWorkspaceSlimHeaderRoute ? "py-3 sm:px-6 sm:py-4" : "py-5 sm:px-8 sm:py-8 lg:py-10"
            )}
            tabIndex={-1}
          >
            <div className={cn(!isWorkspaceSlimHeaderRoute && "space-y-6 sm:space-y-8")}>
              {!isWorkspaceSlimHeaderRoute && (
                <ClientPageHeaderSlot
                  pathname={pathname}
                  intakeWaived={clientIntakeWaived}
                  branding={clientAdvisorBranding}
                />
              )}
              {children}
            </div>
          </main>

          {showClientBrandedFooter && clientAdvisorBranding ? (
            <div
              className={cn(
                "px-4 lg:px-10",
                isWorkspaceSlimHeaderRoute
                  ? "py-3 sm:px-6 sm:py-4"
                  : "pb-5 sm:px-8 sm:pb-8 lg:pb-10",
              )}
              data-testid="client-portal-footer"
            >
              <BrandedPortalFooter
                branding={clientAdvisorBranding}
                tenantPathPrefix={tenantPathPrefix}
                className="mt-0"
              />
            </div>
          ) : null}
        </div>
      </div>
    </div>
    </>
  );

  if (clientAdvisorBranding) {
    return (
      <BrandingProvider
        branding={clientAdvisorBranding}
        subdomain={clientPortalSubdomain}
      >
        <ClientPortalRootTheme branding={clientAdvisorBranding} />
        {shell}
      </BrandingProvider>
    );
  }

  return shell;
}

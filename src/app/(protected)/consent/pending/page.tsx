import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import {
  hasPendingConsent,
  resolveConsentPromptAssignments,
} from "@/lib/advisor/pending-consent";
import { ConsentDecisionForm } from "@/components/consent/ConsentDecisionForm";
import { buildSignInHref } from "@/lib/auth/sign-in-routes";
import {
  consentPendingHref,
  resolveConsentReturnPath,
} from "@/lib/advisor/require-consent-resolved";
import {
  getTenantPathPrefixFromHeaders,
  tenantPublicPath,
} from "@/lib/client/tenant-path-prefix";
import { stripTenantPathPrefix } from "@/lib/client/tenant-path-prefix-client";

/**
 * Option D session 2.2 (BRD §5.1 amendment) — per-assignment consent
 * prompt. Reached via the /dashboard early gate when the client has
 * at least one ACTIVE assignment with null fieldVisibility.
 *
 * Idempotent revisit: when every flagged assignment has a non-null
 * fieldVisibility (the consent decisions have been recorded), the
 * helper returns [] and we redirect to `redirectTo` (when set) or /dashboard.
 *
 * Auth: only clients (role USER) see this page. Advisors and admins
 * are redirected to their respective hubs — they shouldn't end up
 * here in normal flow, but defense-in-depth in case the dashboard
 * gate is bypassed somehow (e.g. direct-link).
 */
export default async function ConsentPendingPage({
  searchParams,
}: {
  searchParams: Promise<{ redirectTo?: string }>;
}) {
  const { redirectTo: redirectToRaw } = await searchParams;
  const tenantPrefix = await getTenantPathPrefixFromHeaders();
  const returnTo = resolveConsentReturnPath(redirectToRaw);
  const scopedReturnTo = await tenantPublicPath(stripTenantPathPrefix(returnTo));
  const [settingsHref, profilesHref] = await Promise.all([
    tenantPublicPath("/settings"),
    tenantPublicPath("/profiles"),
  ]);
  const consentCallback = consentPendingHref(
    stripTenantPathPrefix(scopedReturnTo),
    tenantPrefix,
  );

  const session = await auth();
  if (!session?.user?.id) {
    redirect(buildSignInHref({ callbackUrl: consentCallback }));
  }

  const role = session.user.role?.toString().toUpperCase();
  if (role === "ADVISOR") redirect("/advisor");
  if (role === "ADMIN") redirect("/admin");

  const assignments = await resolveConsentPromptAssignments(session.user.id);
  if (assignments.length === 0) {
    if (!(await hasPendingConsent(session.user.id))) {
      redirect(scopedReturnTo);
    }

    return (
      <section className="hero-surface rounded-[1.75rem] p-4 sm:p-8">
        <div className="mx-auto max-w-2xl space-y-4 text-sm text-foreground/80">
          <h1 className="text-2xl font-semibold text-foreground">
            Privacy preferences unavailable
          </h1>
          <p>
            We could not load your consent preferences. Refresh the page or
            contact your advisor if this continues.
          </p>
        </div>
      </section>
    );
  }

  const continueTarget =
    stripTenantPathPrefix(scopedReturnTo) === "/assessment"
      ? "your assessment"
      : "your dashboard";

  return (
    <section className="hero-surface rounded-[1.75rem] p-4 sm:p-8">
      <div className="mx-auto max-w-2xl space-y-8">
        <header className="space-y-2">
          <p className="editorial-kicker">Privacy</p>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            Consent preferences
          </h1>
          <p className="max-w-xl text-sm leading-relaxed text-foreground/80">
            {assignments.length === 1
              ? `Before you continue to ${continueTarget}, choose which optional details your advisor can see. You can change these anytime in Settings.`
              : `Before you continue to ${continueTarget}, choose which optional details each advisor can see. You can change these anytime in Settings.`}
          </p>
        </header>

        <ConsentDecisionForm
          assignments={assignments}
          returnTo={scopedReturnTo}
          settingsHref={settingsHref}
          profilesHref={profilesHref}
        />
      </div>
    </section>
  );
}

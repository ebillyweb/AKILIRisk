import Link from "next/link";
import { headers } from "next/headers";
import { getAdvisorBrandingBySubdomain } from "@/lib/advisor/subdomain";
import { BrandedLandingHero } from "@/components/branding/BrandedLandingHero";
import { BrandedPortalShell } from "@/components/branding/BrandedPortalShell";
import { resolveBrandedLandingCopy } from "@/lib/branding/landing-copy";
import { withClientPortalLogoSrc } from "@/lib/client/resolve-client-portal-branding";
import { tenantPublicPath } from "@/lib/client/tenant-path-prefix";

export default async function BrandedClientPortalPage() {
  const headersList = await headers();
  const subdomain = headersList.get("x-subdomain");

  if (!subdomain) {
    return <div>Error: Invalid subdomain</div>;
  }

  const brandingRaw = await getAdvisorBrandingBySubdomain(subdomain);

  if (!brandingRaw) {
    return <div>Error: Branding not found</div>;
  }

  const branding = withClientPortalLogoSrc(brandingRaw, true);
  const copy = resolveBrandedLandingCopy(branding);
  const homeHref = await tenantPublicPath("/");
  const startHref = await tenantPublicPath("/start");
  const signInHref = await tenantPublicPath("/signin?role=client");
  const advisorSignInHref = await tenantPublicPath("/signin?role=advisor");
  const requestReviewHref = await tenantPublicPath("/request-review");
  const tenantPathPrefix = headersList.get("x-tenant-path-prefix");

  return (
    <BrandedPortalShell
      branding={branding}
      homeHref={homeHref}
      tenantPathPrefix={tenantPathPrefix}
      variant="landing"
    >
      <BrandedLandingHero
        copy={copy}
        startHref={startHref}
        signInHref={signInHref}
        requestReviewHref={requestReviewHref}
      />
      <p className="mt-8 text-center text-sm text-muted-foreground">
        Advisor or firm team member?{" "}
        <Link
          href={advisorSignInHref}
          className="font-semibold text-foreground underline-offset-4 hover:underline"
        >
          Sign in to your workspace
        </Link>
      </p>
    </BrandedPortalShell>
  );
}

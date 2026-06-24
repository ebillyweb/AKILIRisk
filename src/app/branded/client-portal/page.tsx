import Link from "next/link";
import { headers } from "next/headers";
import { getAdvisorBrandingBySubdomain } from "@/lib/advisor/subdomain";
import { AuthPanel } from "@/components/auth/AuthPanel";
import { InviteCodeForm } from "@/components/auth/InviteCodeForm";
import { BrandedPortalShell } from "@/components/branding/BrandedPortalShell";
import { HeroFeatureCard } from "@/components/home/hero/HeroFeatureCard";
import { HOME_HERO_FEATURES } from "@/components/home/hero/home-hero-features";
import { withClientPortalLogoSrc } from "@/lib/client/resolve-client-portal-branding";

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
  const kicker = branding.tagline?.trim() || "Personal Risk Profile";

  return (
    <BrandedPortalShell
      branding={branding}
      homeHref="/"
      variant="landing"
      titleAsHeading
    >
      <div className="space-y-10">
        <div className="space-y-3 text-center">
          <p className="editorial-kicker">{kicker}</p>
          <h2 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
            Comprehensive Family Risk Assessment
          </h2>
          <p className="mx-auto max-w-2xl text-base leading-7 text-muted-foreground">
            Protect what matters most with a professional risk analysis and governance
            recommendations tailored to your family&apos;s unique situation.
          </p>
        </div>

        <div className="mx-auto w-full max-w-md">
          <AuthPanel
            eyebrow="Get started"
            title="Access your assessment"
            description="Enter the invite code from your advisor, or use your invitation link to sign up."
            footer={
              <span>
                Already have an account?{" "}
                <Link
                  href="/signin/magic-link"
                  className="font-semibold text-foreground hover:underline"
                >
                  Sign in
                </Link>
              </span>
            }
          >
            <InviteCodeForm submitLabel="Continue assessment" />
          </AuthPanel>
        </div>

        <div className="space-y-4">
          <h3 className="text-center text-lg font-semibold tracking-tight">
            What to expect
          </h3>
          <div className="grid gap-4 sm:grid-cols-3">
            {HOME_HERO_FEATURES.map((feature) => (
              <HeroFeatureCard
                key={feature.title}
                title={feature.title}
                description={feature.description}
                icon={feature.icon}
              />
            ))}
          </div>
        </div>
      </div>
    </BrandedPortalShell>
  );
}

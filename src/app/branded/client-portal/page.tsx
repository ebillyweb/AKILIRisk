import Link from "next/link";
import { Lock, ShieldCheck, Sparkles } from "lucide-react";
import { headers } from "next/headers";
import { getAdvisorBrandingBySubdomain } from "@/lib/advisor/subdomain";
import { AuthPanel } from "@/components/auth/AuthPanel";
import { InviteCodeForm } from "@/components/auth/InviteCodeForm";
import { BrandedPortalShell } from "@/components/branding/BrandedPortalShell";
import { HeroFeatureCard } from "@/components/home/hero/HeroFeatureCard";
import { HOME_HERO_FEATURES } from "@/components/home/hero/home-hero-features";
import { MarketingSection } from "@/components/marketing/MarketingSection";
import { MarketingSurfaceCard } from "@/components/marketing/MarketingSurfaceCard";
import { withClientPortalLogoSrc } from "@/lib/client/resolve-client-portal-branding";
import { clientPortalBrandingDisplayTitle } from "@/lib/client/client-portal-branding";

const TRUST_SIGNALS = [
  { label: "Encrypted & private", icon: Lock },
  { label: "Advisor-led process", icon: ShieldCheck },
  { label: "Tailored recommendations", icon: Sparkles },
] as const;

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
  const brandTitle = clientPortalBrandingDisplayTitle(branding);
  const kicker = branding.tagline?.trim() || "Personal Risk Profile";

  return (
    <BrandedPortalShell
      branding={branding}
      homeHref="/"
      variant="landing"
      titleAsHeading
    >
      <div className="space-y-12 sm:space-y-14">
        <div className="mx-auto max-w-3xl space-y-5 text-center">
          <p className="editorial-kicker">{kicker}</p>
          <h2 className="font-display text-3xl font-semibold leading-tight text-balance sm:text-4xl lg:text-5xl">
            Comprehensive family risk assessment through {brandTitle}
          </h2>
          <p className="mx-auto max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
            Protect what matters most with a professional governance analysis and
            structured recommendations tailored to your family&apos;s unique situation.
          </p>
          <ul
            className="flex flex-wrap items-center justify-center gap-2"
            aria-label="Trust signals"
          >
            {TRUST_SIGNALS.map(({ label, icon: Icon }) => (
              <li
                key={label}
                className="branded-trust-badge inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/45 px-3 py-1.5 text-xs font-medium text-muted-foreground"
              >
                <Icon className="size-3.5 text-brand" aria-hidden />
                {label}
              </li>
            ))}
          </ul>
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
                  href="/signin?role=client"
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

        <MarketingSection
          kicker="What to expect"
          title="A structured path from assessment to action"
          description="Your advisor guides the process — AKILI provides the governance intelligence behind it."
          align="center"
          className="!space-y-6"
        >
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
        </MarketingSection>

        <MarketingSurfaceCard className="mx-auto max-w-2xl text-center">
          <p className="text-sm leading-6 text-muted-foreground">
            Questions before you begin? Contact {brandTitle} using the details in the
            footer, or{" "}
            <Link href="/signin?role=client" className="font-semibold text-foreground hover:underline">
              sign in
            </Link>{" "}
            if you already have an account.
          </p>
        </MarketingSurfaceCard>
      </div>
    </BrandedPortalShell>
  );
}

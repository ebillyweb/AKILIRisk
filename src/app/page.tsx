import { auth } from "@/lib/auth";
import { isAdvisorHubNavRole } from "@/lib/auth-roles";
import { resolveAdvisorWorkspaceTitleForUserId } from "@/lib/advisor/advisor-workspace-label.server";
import { LandingHero } from "@/components/home/hero/LandingHero";
import { LandingPricingPreview } from "@/components/home/LandingPricingPreview";
import { parseHeroAudienceParam } from "@/components/home/hero/hero-audience-persistence";
import { LandingAudienceGrid } from "@/components/marketing/LandingAudienceGrid";
import { LandingHowItWorks } from "@/components/marketing/LandingHowItWorks";
import { LandingProductPreview } from "@/components/marketing/LandingProductPreview";
import { LandingTrustSection } from "@/components/marketing/LandingTrustSection";
import { SiteFooter } from "@/components/marketing/SiteFooter";
import { SiteHeader } from "@/components/marketing/SiteHeader";
import { fetchPublicTierPricing } from "@/lib/billing/public-tier-pricing";

type HomePageProps = {
  searchParams: Promise<{ audience?: string }>;
};

export default async function Home({ searchParams }: HomePageProps) {
  const session = await auth();
  const { audience: audienceParam } = await searchParams;
  const initialAudience = parseHeroAudienceParam(audienceParam) ?? "families";
  const advisorWorkspaceTitle =
    session?.user?.id && isAdvisorHubNavRole(session.user.role)
      ? await resolveAdvisorWorkspaceTitleForUserId(session.user.id)
      : undefined;
  const pricingPreview = await fetchPublicTierPricing();

  return (
    <>
      <a href="#main-content" className="skip-to-content">
        Skip to main content
      </a>
      <main id="main-content" className="min-h-screen pb-10 pt-2 sm:pb-12" tabIndex={-1}>
        <div className="page-shell space-y-16 sm:space-y-20">
          <SiteHeader />
          <LandingHero
            initialAudience={initialAudience}
            authenticated={Boolean(session?.user)}
            userEmail={session?.user?.email}
            advisorWorkspaceTitle={advisorWorkspaceTitle}
          />

          <LandingHowItWorks />
          <LandingAudienceGrid />
          <LandingProductPreview />
          <LandingTrustSection />
          <LandingPricingPreview pricing={pricingPreview} />
          <SiteFooter />
        </div>
      </main>
    </>
  );
}

import { auth } from "@/lib/auth";
import { isAdvisorHubNavRole } from "@/lib/auth-roles";
import { resolveAdvisorWorkspaceTitleForUserId } from "@/lib/advisor/advisor-workspace-label.server";
import { LandingHero } from "@/components/home/hero/LandingHero";
import type { HeroAudience } from "@/components/home/hero/hero-audience-content";
import { LandingPricingPreview } from "@/components/home/LandingPricingPreview";
import { LandingHowItWorks } from "@/components/marketing/LandingHowItWorks";
import { LandingOutcomesSection } from "@/components/marketing/LandingOutcomesSection";
import { LandingProductPreview } from "@/components/marketing/LandingProductPreview";
import { PublicPageShell } from "@/components/marketing/PublicPageShell";
import { fetchPublicTierPricing } from "@/lib/billing/public-tier-pricing";

type HomePageContentProps = {
  initialAudience: HeroAudience;
};

export async function HomePageContent({ initialAudience }: HomePageContentProps) {
  const session = await auth();
  const advisorWorkspaceTitle =
    session?.user?.id && isAdvisorHubNavRole(session.user.role)
      ? await resolveAdvisorWorkspaceTitleForUserId(session.user.id)
      : undefined;
  const { pricing: pricingPreview } = await fetchPublicTierPricing();

  return (
    <PublicPageShell
      maxWidth="full"
      className="space-y-0"
      contentClassName="flex flex-col gap-14 sm:gap-20 lg:gap-24 space-y-0"
      heroAudienceInitial={initialAudience}
    >
      <LandingHero
        authenticated={Boolean(session?.user)}
        userEmail={session?.user?.email}
        advisorWorkspaceTitle={advisorWorkspaceTitle}
      />
      <LandingProductPreview />
      <LandingHowItWorks />
      <LandingOutcomesSection />
      <LandingPricingPreview pricing={pricingPreview} />
    </PublicPageShell>
  );
}

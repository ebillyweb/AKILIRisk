import { HeroFeatureCard } from "@/components/home/hero/HeroFeatureCard";
import { HOME_HERO_FEATURES } from "@/components/home/hero/home-hero-features";
import { resolveLandingFeatureCards } from "@/lib/branding/landing-copy";
import { clientPortalBrandingDisplayTitle } from "@/lib/client/client-portal-branding";
import type { AdvisorBrandingData } from "@/lib/validation/branding";

type BrandedPortalAuthSupplementProps = {
  branding: AdvisorBrandingData;
};

export function BrandedPortalAuthSupplement({ branding }: BrandedPortalAuthSupplementProps) {
  const brandTitle = clientPortalBrandingDisplayTitle(branding);

  // Honor the advisor-editable landing copy (Branding settings → Landing copy),
  // falling back to the standard defaults so unconfigured firms are unchanged.
  const kicker =
    branding.landingKicker?.trim() ||
    branding.tagline?.trim() ||
    "Personal Risk Profile";
  const headline =
    branding.landingHeadline?.trim() ||
    `Governance intelligence through ${brandTitle}.`;
  const subheadline =
    branding.landingSubheadline?.trim() ||
    "A structured personal risk profile designed for high-trust advisory relationships — discreet, encrypted, and tailored to your family's situation.";

  // Editable feature cards (title/description/visibility), icons mapped by index.
  const cards = resolveLandingFeatureCards(branding.landingFeatureCards)
    .map((card, index) => ({ ...card, icon: HOME_HERO_FEATURES[index]?.icon }))
    .filter((card) => card.visible && card.icon);

  return (
    <>
      <div className="space-y-6">
        <p className="editorial-kicker">{kicker}</p>
        <div className="max-w-xl space-y-4">
          <h1 className="text-4xl font-semibold leading-[1.05] text-balance sm:text-5xl">
            {headline}
          </h1>
          <p className="text-base leading-7 text-muted-foreground sm:text-lg">
            {subheadline}
          </p>
        </div>
      </div>

      {cards.length > 0 ? (
        <div className="hidden gap-4 sm:grid-cols-3 lg:grid">
          {cards.map((card, index) => (
            <HeroFeatureCard
              key={`${card.title}-${index}`}
              title={card.title}
              description={card.description}
              icon={card.icon!}
            />
          ))}
        </div>
      ) : null}
    </>
  );
}

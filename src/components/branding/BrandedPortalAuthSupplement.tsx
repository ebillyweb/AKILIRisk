import { HeroFeatureCard } from "@/components/home/hero/HeroFeatureCard";
import { HOME_HERO_FEATURES } from "@/components/home/hero/home-hero-features";
import { clientPortalBrandingDisplayTitle } from "@/lib/client/client-portal-branding";
import type { AdvisorBrandingData } from "@/lib/validation/branding";

type BrandedPortalAuthSupplementProps = {
  branding: AdvisorBrandingData;
};

export function BrandedPortalAuthSupplement({ branding }: BrandedPortalAuthSupplementProps) {
  const brandTitle = clientPortalBrandingDisplayTitle(branding);
  const tagline = branding.tagline?.trim();

  return (
    <>
      <div className="space-y-6">
        <p className="editorial-kicker">{tagline || "Personal Risk Profile"}</p>
        <div className="max-w-xl space-y-4">
          <h1 className="text-4xl font-semibold leading-[1.05] text-balance sm:text-5xl">
            Governance intelligence through {brandTitle}.
          </h1>
          <p className="text-base leading-7 text-muted-foreground sm:text-lg">
            A structured personal risk profile designed for high-trust advisory
            relationships — discreet, encrypted, and tailored to your family&apos;s
            situation.
          </p>
        </div>
      </div>

      <div className="hidden gap-4 sm:grid-cols-3 lg:grid">
        {HOME_HERO_FEATURES.map((feature) => (
          <HeroFeatureCard
            key={feature.title}
            title={feature.title}
            description={feature.description}
            icon={feature.icon}
          />
        ))}
      </div>
    </>
  );
}

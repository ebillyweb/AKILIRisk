import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { HomePageContent } from "@/components/marketing/HomePageContent";
import { parseHeroAudienceParam } from "@/components/home/hero/hero-audience-persistence";
import { heroAudiencePath } from "@/lib/marketing/friendly-urls";
import { withCanonical } from "@/lib/seo/site";

export const metadata: Metadata = withCanonical("/", {
  title: "AKILI Risk Intelligence",
  description:
    "Governance intelligence platform for modern family wealth — structured assessments, prioritized risks, and actionable recommendations for professional firms and families.",
});

type HomePageProps = {
  searchParams: Promise<{ audience?: string }>;
};

export default async function Home({ searchParams }: HomePageProps) {
  const { audience: audienceParam } = await searchParams;
  const legacyAudience = parseHeroAudienceParam(audienceParam);
  if (legacyAudience) {
    redirect(heroAudiencePath(legacyAudience));
  }

  return <HomePageContent initialAudience="families" />;
}

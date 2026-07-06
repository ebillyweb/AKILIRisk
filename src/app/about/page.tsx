import type { Metadata } from "next";
import { MarketingPage } from "@/components/marketing/MarketingPage";
import {
  aboutUsHeroDescription,
  aboutUsSections,
} from "@/lib/marketing/content";
import { withCanonical } from "@/lib/seo/site";

export const metadata: Metadata = withCanonical("/about", {
  title: "About",
});

export default function AboutUsPage() {
  return (
    <MarketingPage
      title="About"
      kicker="Company"
      heroDescription={aboutUsHeroDescription}
      sections={aboutUsSections}
      sectionsVariant="cards"
    />
  );
}

import type { Metadata } from "next";

import { HomePageContent } from "@/components/marketing/HomePageContent";
import { withCanonical } from "@/lib/seo/site";

export const metadata: Metadata = withCanonical("/how-it-works", {
  title: "How It Works",
  description:
    "Assess, analyze, and act — structured intake across modular risk domains with prioritized recommendations for families and firms.",
});

export default function HowItWorksPage() {
  return <HomePageContent initialAudience="overview" />;
}

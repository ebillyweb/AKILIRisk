import type { Metadata } from "next";

import { HomePageContent } from "@/components/marketing/HomePageContent";
import { withCanonical } from "@/lib/seo/site";

export const metadata: Metadata = withCanonical("/firms", {
  title: "For Firms",
  description:
    "Governance intelligence workspace for wealth advisors, CPAs, estate attorneys, and family offices serving affluent households.",
});

export default function FirmsPage() {
  return <HomePageContent initialAudience="advisors" />;
}

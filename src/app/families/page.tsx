import type { Metadata } from "next";

import { HomePageContent } from "@/components/marketing/HomePageContent";
import { withCanonical } from "@/lib/seo/site";

export const metadata: Metadata = withCanonical("/families", {
  title: "For Families",
  description:
    "Structured personal risk profiles for affluent households — surface governance gaps with guidance from your professional team.",
});

export default function FamiliesPage() {
  return <HomePageContent initialAudience="families" />;
}

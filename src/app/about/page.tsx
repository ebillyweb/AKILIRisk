import type { Metadata } from "next";
import { MarketingPage } from "@/components/marketing/MarketingPage";
import { aboutUsSections } from "@/lib/marketing/content";

export const metadata: Metadata = {
  title: "About Us",
};

export default function AboutUsPage() {
  return (
    <MarketingPage title="About Us" sections={aboutUsSections} />
  );
}

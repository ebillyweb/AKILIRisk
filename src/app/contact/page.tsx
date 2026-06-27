import type { Metadata } from "next";
import { Suspense } from "react";
import { ContactForm } from "@/components/marketing/ContactForm";
import { MarketingPage } from "@/components/marketing/MarketingPage";
import {
  contactUsHeroDescription,
  contactUsSections,
} from "@/lib/marketing/content";

export const metadata: Metadata = {
  title: "Contact Us",
};

export default function ContactUsPage() {
  return (
    <MarketingPage
      title="Contact Us"
      kicker="Contact"
      heroDescription={contactUsHeroDescription}
      sections={contactUsSections}
      layout="split"
    >
      <Suspense fallback={null}>
        <ContactForm />
      </Suspense>
    </MarketingPage>
  );
}

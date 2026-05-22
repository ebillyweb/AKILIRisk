import type { Metadata } from "next";
import { ContactForm } from "@/components/marketing/ContactForm";
import { MarketingPage } from "@/components/marketing/MarketingPage";
import { contactUsSections } from "@/lib/marketing/content";

export const metadata: Metadata = {
  title: "Contact Us",
};

export default function ContactUsPage() {
  return (
    <MarketingPage
      title="Contact Us"
      sections={contactUsSections}
      kicker="Contact"
    >
      <ContactForm />
    </MarketingPage>
  );
}

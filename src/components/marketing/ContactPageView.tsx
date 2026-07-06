import { ContactForm } from "@/components/marketing/ContactForm";
import { MarketingPage } from "@/components/marketing/MarketingPage";
import { SiteBusinessContact } from "@/components/marketing/SiteBusinessContact";
import {
  contactUsHeroDescription,
  contactUsSections,
} from "@/lib/marketing/content";
import type { ContactFormIntent } from "@/lib/marketing/contact-form-intent";

type ContactPageViewProps = {
  intent?: ContactFormIntent;
};

export function ContactPageView({ intent }: ContactPageViewProps) {
  return (
    <MarketingPage
      title="Contact Us"
      kicker="Contact"
      heroDescription={contactUsHeroDescription}
      sections={contactUsSections}
      layout="split"
    >
      <div className="space-y-5">
        <SiteBusinessContact variant="contact" />
        <ContactForm intent={intent ?? null} />
      </div>
    </MarketingPage>
  );
}

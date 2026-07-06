import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { ContactPageView } from "@/components/marketing/ContactPageView";
import {
  parseContactFormIntent,
} from "@/lib/marketing/contact-form-intent";
import { contactIntentPath } from "@/lib/marketing/friendly-urls";
import { withCanonical } from "@/lib/seo/site";

export const metadata: Metadata = withCanonical("/contact", {
  title: "Contact Us",
});

type ContactUsPageProps = {
  searchParams: Promise<{ intent?: string }>;
};

export default async function ContactUsPage({ searchParams }: ContactUsPageProps) {
  const { intent: intentParam } = await searchParams;
  const legacyIntent = parseContactFormIntent(intentParam);
  if (legacyIntent) {
    redirect(contactIntentPath(legacyIntent));
  }

  return (
    <Suspense fallback={null}>
      <ContactPageView />
    </Suspense>
  );
}

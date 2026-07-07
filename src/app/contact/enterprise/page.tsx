import type { Metadata } from "next";
import { Suspense } from "react";

import { ContactPageView } from "@/components/marketing/ContactPageView";
import { withCanonical } from "@/lib/seo/site";

export const metadata: Metadata = withCanonical("/contact/enterprise", {
  title: "Enterprise Contact",
  description:
    "Contact AKILI about Enterprise plans for multi-advisor firms and custom billing.",
});

export default function ContactEnterprisePage() {
  return (
    <Suspense fallback={null}>
      <ContactPageView intent="enterprise" />
    </Suspense>
  );
}

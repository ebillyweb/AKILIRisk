import type { Metadata } from "next";
import { Suspense } from "react";

import { ContactPageView } from "@/components/marketing/ContactPageView";
import { withCanonical } from "@/lib/seo/site";

export const metadata: Metadata = withCanonical("/contact/demo", {
  title: "Request a Demo",
  description:
    "Schedule a walkthrough of the AKILI advisor workspace for your firm.",
});

export default function ContactDemoPage() {
  return (
    <Suspense fallback={null}>
      <ContactPageView intent="demo" />
    </Suspense>
  );
}

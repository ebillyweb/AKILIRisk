import type { Metadata } from "next";
import { LegalDocumentPage } from "@/components/legal/LegalDocumentPage";
import { termsOfServiceSections } from "@/lib/legal/documents";
import { withCanonical } from "@/lib/seo/site";

export const metadata: Metadata = withCanonical("/terms", {
  title: "Terms of Service",
});

export default function TermsOfServicePage() {
  return (
    <LegalDocumentPage
      title="Terms of Service"
      sections={termsOfServiceSections}
    />
  );
}

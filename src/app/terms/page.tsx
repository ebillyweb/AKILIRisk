import type { Metadata } from "next";
import { LegalDocumentPage } from "@/components/legal/LegalDocumentPage";
import { termsOfServiceSections } from "@/lib/legal/documents";

export const metadata: Metadata = {
  title: "Terms of Service",
};

export default function TermsOfServicePage() {
  return (
    <LegalDocumentPage
      title="Terms of Service"
      sections={termsOfServiceSections}
      otherPolicyHref="/privacy"
      otherPolicyLabel="Privacy Policy"
    />
  );
}

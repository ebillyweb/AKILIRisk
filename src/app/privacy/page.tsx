import type { Metadata } from "next";
import { LegalDocumentPage } from "@/components/legal/LegalDocumentPage";
import { privacyPolicySections } from "@/lib/legal/documents";

export const metadata: Metadata = {
  title: "Privacy Policy",
};

export default function PrivacyPolicyPage() {
  return (
    <LegalDocumentPage
      title="Privacy Policy"
      sections={privacyPolicySections}
      otherPolicyHref="/terms"
      otherPolicyLabel="Terms of Service"
    />
  );
}

import type { Metadata } from "next";
import { LegalDocumentPage } from "@/components/legal/LegalDocumentPage";
import { privacyPolicySections } from "@/lib/legal/documents";
import { withCanonical } from "@/lib/seo/site";

export const metadata: Metadata = withCanonical("/privacy", {
  title: "Privacy Policy",
});

export default function PrivacyPolicyPage() {
  return (
    <LegalDocumentPage
      title="Privacy Policy"
      sections={privacyPolicySections}
    />
  );
}

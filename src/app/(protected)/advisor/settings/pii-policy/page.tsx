import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { requireAdvisorRole, getAdvisorProfileOrThrow } from "@/lib/advisor/auth";
import { parsePiiPolicy } from "@/lib/advisor/pii-policy";
import { getAdvisorClientDataPolicyContext } from "@/lib/enterprise/enterprise-client-data-policy";
import { PiiPolicyForm } from "@/components/advisor/settings/PiiPolicyForm";
import { ConfigurationPageHeader } from "@/components/product-tour/ConfigurationPageHeader";

/**
 * Option D session 1 commit 1.3 (BRD §5.1 amendment) — advisor PII
 * policy settings page. Server component shell; reads the advisor's
 * current `AdvisorProfile.piiPolicy` and hands it to a client form
 * component for editing.
 *
 * Auth: requireAdvisorRole at the top so a non-advisor (or an advisor
 * with portal access disabled) can't reach the form. Pattern matches
 * the existing /advisor/settings/notifications/page.tsx.
 */
export default async function PiiPolicySettingsPage() {
  const session = await requireAdvisorRole();
  const profile = await getAdvisorProfileOrThrow(session.userId);
  const policy = parsePiiPolicy(profile.piiPolicy);
  const policyContext = await getAdvisorClientDataPolicyContext(session.userId);

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/advisor/settings"
          className="inline-flex items-center text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to settings
        </Link>
      </div>

      <ConfigurationPageHeader
        tourId="advisor-settings-pii-policy"
        title="Client data policy"
        description="Choose how clients appear in your workspace (email or Client CL-…) and which optional intake fields you collect."
      />

      <div data-tour="config-primary-form">
        <PiiPolicyForm
          initialPolicy={policy}
          effectivePolicy={policyContext.effective}
          lockedByEnterprise={policyContext.effective.lockedByEnterprise}
        />
      </div>
    </div>
  );
}

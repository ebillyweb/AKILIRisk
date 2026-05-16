import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { requireAdvisorRole, getAdvisorProfileOrThrow } from "@/lib/advisor/auth";
import { parsePiiPolicy } from "@/lib/advisor/pii-policy";
import { PiiPolicyForm } from "@/components/advisor/settings/PiiPolicyForm";

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

      <div>
        <h1 className="text-3xl font-bold">PII policy</h1>
        <p className="mt-2 text-muted-foreground">
          Choose which optional client PII fields your future clients are
          asked for during intake. The default is opt-out — every field
          is enabled until you change it.
        </p>
      </div>

      <PiiPolicyForm initialPolicy={policy} />
    </div>
  );
}

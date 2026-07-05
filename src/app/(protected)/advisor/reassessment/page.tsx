import { redirect } from "next/navigation";
import Link from "next/link";
import { requireAdvisorRole, getAdvisorProfileOrThrow } from "@/lib/advisor/auth";
import { requireAdvisorTierFeatureAccess } from "@/lib/advisor/tier-feature-guard.server";
import { requireAdvisorReassessmentMemberAccess } from "@/lib/platform/advisor-feature-guards";
import { TierFeatureLockedPage } from "@/components/advisor/billing/TierFeatureLockedPage";
import { REASSESSMENT_COPY } from "@/lib/advisor/assessment-lifecycle-copy";
import { listReassessmentCadenceClients } from "@/lib/cadence/advisor-reassessment-portfolio";
import { ReassessmentCadenceTable } from "@/components/assessment/ReassessmentCadenceTable";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FieldHelp } from "@/components/ui/field-help";

export default async function AdvisorReassessmentCadencePage() {
  await requireAdvisorReassessmentMemberAccess();

  let advisorProfileId: string;
  try {
    const { userId } = await requireAdvisorRole();
    const profile = await getAdvisorProfileOrThrow(userId);
    advisorProfileId = profile.id;
  } catch {
    redirect("/signin");
  }

  const access = await requireAdvisorTierFeatureAccess("REASSESSMENT_WORKFLOW");
  if (!access.allowed) {
    return (
      <TierFeatureLockedPage
        feature="REASSESSMENT_WORKFLOW"
        currentTier={access.currentTier}
      />
    );
  }

  const rows = await listReassessmentCadenceClients(advisorProfileId);

  return (
    <div className="space-y-6">
      <Button variant="outline" size="sm" asChild>
        <Link href="/advisor/pipeline">Clients</Link>
      </Button>

      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold font-display tracking-[-0.03em]">
            {REASSESSMENT_COPY.pageTitle}
          </h1>
          <FieldHelp helpKey="assessment-stale-scores-alert" triggerLabel="Reassessment help" />
        </div>
        <p className="text-sm text-muted-foreground max-w-2xl">
          {REASSESSMENT_COPY.pageSubtitle}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {rows.length} client{rows.length === 1 ? "" : "s"} with completed assessments
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ReassessmentCadenceTable rows={rows} />
        </CardContent>
      </Card>
    </div>
  );
}

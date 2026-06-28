import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdvisorRole } from "@/lib/advisor/auth";
import { requireEnterpriseTeamManager } from "@/lib/enterprise/team-access";
import { loadEnterpriseIntakeQuestions } from "@/lib/methodology/enterprise-methodology-queries";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EnterpriseIntakeScriptEditor } from "@/components/advisor/enterprise/EnterpriseIntakeScriptEditor";
import { ConfigurationPageHeader } from "@/components/product-tour/ConfigurationPageHeader";

export default async function EnterpriseMethodologyIntakePage() {
  let enterpriseId: string;
  let enterpriseName: string;
  try {
    const { userId } = await requireAdvisorRole();
    const team = await requireEnterpriseTeamManager(userId);
    enterpriseId = team.enterpriseId;
    enterpriseName = team.enterpriseName;
  } catch {
    redirect("/signin");
  }

  const questions = await loadEnterpriseIntakeQuestions(enterpriseId);

  return (
    <div className="space-y-6">
      <Button variant="outline" size="sm" asChild>
        <Link href="/advisor/enterprise/methodology">Firm methodology</Link>
      </Button>
      <ConfigurationPageHeader
        tourId="advisor-methodology-intake"
        title={`${enterpriseName} — Intake script`}
        description="Firm-wide intake script syncs to all member advisors."
      />
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {questions.length} question{questions.length === 1 ? "" : "s"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <EnterpriseIntakeScriptEditor
            questions={questions.map((q) => ({
              id: q.id,
              sourceKind: q.sourceKind,
              displayOrder: q.displayOrder,
              questionText: q.questionText,
              context: q.context,
              isVisible: q.isVisible,
            }))}
          />
        </CardContent>
      </Card>
    </div>
  );
}

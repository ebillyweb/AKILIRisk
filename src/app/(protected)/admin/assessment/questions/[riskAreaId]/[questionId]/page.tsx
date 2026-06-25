import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireAdminRole } from "@/lib/admin/auth";
import { updatePillarQuestionContent } from "@/lib/actions/admin-question-bank-actions";
import { PillarQuestionBankFields } from "@/components/admin/PillarQuestionBankFields";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { riskAreaIdForPillarCategory } from "@/lib/assessment/bank/pillar-category-risk-area";
import { isRiskAreaId, legacyRiskAreaRedirect, riskAreaFromCatalog } from "@/lib/assessment/bank/risk-areas";
import { getPlatformPillarCatalog } from "@/lib/methodology/cached-pillar-catalog";
import { adminAssessmentQuestionsAreaPath } from "@/lib/admin/assessment-questions-paths";
import { formatQuestionTextForDisplay } from "@/lib/assessment/bank/question-bank-display";
import { prisma } from "@/lib/db";

export default async function AdminQuestionBankEditPage({
  params,
  searchParams,
}: {
  params: Promise<{ riskAreaId: string; questionId: string }>;
  searchParams: Promise<{ err?: string; saved?: string }>;
}) {
  await requireAdminRole();
  const { riskAreaId, questionId: questionIdParam } = await params;
  const { err, saved } = await searchParams;
  const questionId = decodeURIComponent(questionIdParam);

  const legacy = legacyRiskAreaRedirect(riskAreaId);
  if (legacy) {
    redirect(
      `${adminAssessmentQuestionsAreaPath(legacy)}/${encodeURIComponent(questionId)}`
    );
  }

  const catalog = await getPlatformPillarCatalog();

  if (!isRiskAreaId(riskAreaId, catalog)) {
    notFound();
  }

  const area = riskAreaFromCatalog(catalog, riskAreaId)!;

  const pillarRow = await prisma.pillarQuestion.findUnique({
    where: { id: questionId },
    include: { section: { include: { category: true } } },
  });

  if (
    !pillarRow ||
    riskAreaIdForPillarCategory(pillarRow.section.category) !== riskAreaId
  ) {
    notFound();
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="outline" size="sm" asChild>
          <Link href={adminAssessmentQuestionsAreaPath(riskAreaId)}>Back to {area.name}</Link>
        </Button>
        <Link
          href={`/admin/audit-log/entity/PillarQuestion/${pillarRow.id}`}
          className="text-sm text-muted-foreground hover:text-foreground hover:underline"
        >
          View history
        </Link>
      </div>

      {saved === "1" ? (
        <Alert>
          <AlertTitle>Saved</AlertTitle>
          <AlertDescription>
            Question bank changes are live for new assessments.
          </AlertDescription>
        </Alert>
      ) : null}

      {err ? (
        <Alert variant="destructive">
          <AlertTitle>Could not save</AlertTitle>
          <AlertDescription>{err}</AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Edit question</CardTitle>
          <p className="text-sm text-muted-foreground">{area.name}</p>
        </CardHeader>
        <CardContent>
          <form action={updatePillarQuestionContent} className="space-y-4">
            <input type="hidden" name="questionId" value={pillarRow.id} />
            <input type="hidden" name="riskAreaId" value={riskAreaId} />
            <PillarQuestionBankFields
              answerType={pillarRow.answerType}
              defaultText={formatQuestionTextForDisplay(pillarRow.questionText)}
              defaultHelpText={pillarRow.whyThisMatters ?? ""}
              defaultLearnMore={pillarRow.recommendedActions ?? ""}
              defaultRiskRelevance=""
              defaultAnswer0={pillarRow.answer0 ?? ""}
              defaultAnswer1={pillarRow.answer1 ?? ""}
              defaultAnswer2={pillarRow.answer2 ?? ""}
              defaultAnswer3={pillarRow.answer3 ?? ""}
              defaultCrossReference={pillarRow.crossReference ?? ""}
              defaultQuestionNumber={pillarRow.questionNumber ?? ""}
              defaultIsSubQuestion={pillarRow.isSubQuestion}
              defaultIsKeyRiskIndicator={pillarRow.isKeyRiskIndicator}
              defaultDisplayOrder={pillarRow.displayOrder}
            />
            <Button type="submit">Save changes</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

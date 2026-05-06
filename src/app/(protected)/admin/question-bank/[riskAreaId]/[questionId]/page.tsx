import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireAdminRole } from "@/lib/admin/auth";
import {
  updateAssessmentBankQuestionContent,
  updatePillarQuestionContent,
} from "@/lib/actions/admin-question-bank-actions";
import { AssessmentBankQuestionFields } from "@/components/admin/AssessmentBankQuestionFields";
import { PillarQuestionBankFields } from "@/components/admin/PillarQuestionBankFields";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { riskAreaIdForPillarCategory } from "@/lib/assessment/bank/pillar-category-risk-area";
import { isRiskAreaId } from "@/lib/assessment/bank/risk-areas";
import { RISK_AREAS } from "@/lib/advisor/types";
import { prisma } from "@/lib/db";

function jsonField(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }
  return JSON.stringify(value, null, 2);
}

export default async function AdminQuestionBankEditPage({
  params,
  searchParams,
}: {
  params: Promise<{ riskAreaId: string; questionId: string }>;
  searchParams: Promise<{ err?: string }>;
}) {
  await requireAdminRole();
  const { riskAreaId, questionId: questionIdParam } = await params;
  const { err } = await searchParams;
  const questionId = decodeURIComponent(questionIdParam);

  if (!isRiskAreaId(riskAreaId)) {
    notFound();
  }

  const area = RISK_AREAS.find((a) => a.id === riskAreaId)!;

  const bankRow = await prisma.assessmentBankQuestion.findUnique({
    where: { questionId },
  });

  if (bankRow && bankRow.riskAreaId === riskAreaId) {
    const defaultOptionsJson = jsonField(bankRow.options);
    const defaultScoreMapJson = jsonField(bankRow.scoreMap);
    const defaultBranchingPredicateJson = jsonField(bankRow.branchingPredicate);

    return (
      <div className="max-w-3xl space-y-6">
        <div className="flex items-center justify-between">
          <Button variant="outline" size="sm" asChild>
            <Link href={`/admin/question-bank/${riskAreaId}`}>Back to {area.name}</Link>
          </Button>
          <Link
            href={`/admin/audit-log/entity/AssessmentBankQuestion/${bankRow.id}`}
            className="text-sm text-muted-foreground hover:text-foreground hover:underline"
          >
            View history (BRD §7.2)
          </Link>
        </div>

        {err ? (
          <Alert variant="destructive">
            <AlertTitle>Could not save</AlertTitle>
            <AlertDescription>{err}</AlertDescription>
          </Alert>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle className="font-mono text-base">{bankRow.questionId}</CardTitle>
            <p className="text-sm text-muted-foreground">{area.name}</p>
          </CardHeader>
          <CardContent>
            <form action={updateAssessmentBankQuestionContent} className="space-y-4">
              <input type="hidden" name="questionId" value={bankRow.questionId} />
              <input type="hidden" name="riskAreaId" value={riskAreaId} />
              <AssessmentBankQuestionFields
                defaultType={bankRow.type}
                defaultText={bankRow.text}
                defaultHelpText={bankRow.helpText ?? ""}
                defaultLearnMore={bankRow.learnMore ?? ""}
                defaultRiskRelevance={bankRow.riskRelevance ?? ""}
                defaultWeight={bankRow.weight}
                defaultRequired={bankRow.required}
                defaultOptionsJson={defaultOptionsJson}
                defaultScoreMapJson={defaultScoreMapJson}
                defaultBranchingDependsOn={bankRow.branchingDependsOn ?? ""}
                defaultBranchingPredicateJson={defaultBranchingPredicateJson}
                defaultProfileConditionKey={bankRow.profileConditionKey ?? ""}
                defaultOmitMaturityScoreWhenYes={bankRow.omitMaturityScoreWhenYes}
              />
              <Button type="submit">Save changes</Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!z.string().uuid().safeParse(questionId).success) {
    notFound();
  }

  const pillarRow =
    (await prisma.pillarQuestion.findUnique({
      where: { id: questionId },
      include: { section: { include: { category: true } } },
    })) ?? null;

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
          <Link href={`/admin/question-bank/${riskAreaId}`}>Back to {area.name}</Link>
        </Button>
        <Link
          href={`/admin/audit-log/entity/PillarQuestion/${pillarRow.id}`}
          className="text-sm text-muted-foreground hover:text-foreground hover:underline"
        >
          View history (BRD §7.2)
        </Link>
      </div>

      {err ? (
        <Alert variant="destructive">
          <AlertTitle>Could not save</AlertTitle>
          <AlertDescription>{err}</AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="font-mono text-base">{pillarRow.id}</CardTitle>
          <p className="text-sm text-muted-foreground">{area.name} · pillar DDL</p>
        </CardHeader>
        <CardContent>
          <form action={updatePillarQuestionContent} className="space-y-4">
            <input type="hidden" name="questionId" value={pillarRow.id} />
            <input type="hidden" name="riskAreaId" value={riskAreaId} />
            <PillarQuestionBankFields
              answerType={pillarRow.answerType}
              defaultText={pillarRow.questionText}
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
              defaultDisplayOrder={pillarRow.displayOrder}
            />
            <Button type="submit">Save changes</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

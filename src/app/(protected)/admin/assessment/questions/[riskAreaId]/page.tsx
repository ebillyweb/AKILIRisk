import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { requireAdminRole } from "@/lib/admin/auth";
import { isQuestionBankFilterType } from "@/lib/assessment/bank/question-bank-types";
import { isRiskAreaId, legacyRiskAreaRedirect, riskAreaFromCatalog } from "@/lib/assessment/bank/risk-areas";
import { getPlatformPillarCatalog } from "@/lib/methodology/cached-pillar-catalog";
import {
  adminAssessmentQuestionsAreaPath,
  adminAssessmentQuestionsNewPath,
} from "@/lib/admin/assessment-questions-paths";
import { loadQuestionBankDashboardRows } from "@/lib/assessment/bank/question-bank-dashboard";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { QuestionBankRiskAreaFilter } from "@/components/admin/QuestionBankRiskAreaFilter";
import { QuestionBankTypeFilter } from "@/components/admin/QuestionBankTypeFilter";
import { SortableQuestionListWrapper } from "@/components/admin/SortableQuestionListWrapper";

export default async function AdminQuestionBankAreaPage({
  params,
  searchParams,
}: {
  params: Promise<{ riskAreaId: string }>;
  searchParams: Promise<{ type?: string; saved?: string }>;
}) {
  await requireAdminRole();
  const { riskAreaId } = await params;
  const { type: typeParam, saved } = await searchParams;
  const typeFilter = isQuestionBankFilterType(typeParam) ? typeParam : undefined;
  const typeQuery = typeFilter ? `?type=${encodeURIComponent(typeFilter)}` : "";

  const legacy = legacyRiskAreaRedirect(riskAreaId);
  if (legacy) {
    redirect(`${adminAssessmentQuestionsAreaPath(legacy)}${typeQuery}`);
  }

  const catalog = await getPlatformPillarCatalog();

  if (!isRiskAreaId(riskAreaId, catalog)) {
    notFound();
  }

  const area = riskAreaFromCatalog(catalog, riskAreaId)!;

  const questions = await loadQuestionBankDashboardRows(riskAreaId);
  const filteredQuestions = typeFilter
    ? questions.filter((q) => q.type === typeFilter)
    : questions;
  const reorderDisabled = Boolean(typeFilter);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="outline" size="sm" asChild>
          <Link href={`/advisor/question-bank/${riskAreaId}`}>Advisor view</Link>
        </Button>
        <Button size="sm" asChild data-tour="config-primary-action">
          <Link href={adminAssessmentQuestionsNewPath(riskAreaId)}>New question</Link>
        </Button>
        <Suspense fallback={null}>
          <div className="flex flex-wrap items-center gap-4 border-l border-border pl-4" data-tour="config-filters">
            <QuestionBankRiskAreaFilter activeAreaId={riskAreaId} pillars={catalog} />
            <QuestionBankTypeFilter />
          </div>
        </Suspense>
      </div>

      {saved === "1" ? (
        <Alert>
          <AlertDescription>Question bank changes are live for new assessments.</AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{area.name}</CardTitle>
          <p className="text-sm text-muted-foreground">{area.summary}</p>
          {typeFilter ? (
            <p className="text-sm text-muted-foreground pt-1">
              Showing {filteredQuestions.length} of {questions.length} questions (type filter on).
              Reorder is disabled while filtering.
            </p>
          ) : null}
          <p className="text-sm text-muted-foreground pt-1 max-w-2xl">
            Create, edit, hide, reorder, or delete questions. Hidden questions are excluded from
            new assessments.
          </p>
        </CardHeader>
        <CardContent className="p-0" data-tour="config-primary-list">
          {filteredQuestions.length === 0 && questions.length > 0 ? (
            <p className="p-6 text-sm text-muted-foreground">
              No questions match this type filter. Choose &quot;All types&quot; or pick another
              question type.
            </p>
          ) : (
            <SortableQuestionListWrapper
              questions={filteredQuestions.map((q) => ({
                questionId: q.questionId,
                text: q.text,
                helpText: q.helpText,
                learnMore: q.learnMore,
                isVisible: q.isVisible,
                type: q.type,
              }))}
              riskAreaId={riskAreaId}
              typeQuery={typeQuery}
              reorderDisabled={reorderDisabled}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

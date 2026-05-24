import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { requireAdminRole } from "@/lib/admin/auth";
import { RISK_AREAS } from "@/lib/advisor/types";
import { isQuestionBankFilterType } from "@/lib/assessment/bank/question-bank-types";
import { isRiskAreaId, legacyRiskAreaRedirect } from "@/lib/assessment/bank/risk-areas";
import { loadQuestionBankDashboardRows } from "@/lib/assessment/bank/question-bank-dashboard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  deletePillarQuestion,
  movePillarQuestionOrder,
  updatePillarQuestionVisibility,
} from "@/lib/actions/admin-question-bank-actions";
import { DeleteQuestionBankButton } from "@/components/admin/DeleteQuestionBankButton";
import { QuestionBankRiskAreaFilter } from "@/components/admin/QuestionBankRiskAreaFilter";
import { QuestionBankTypeFilter } from "@/components/admin/QuestionBankTypeFilter";
import { ArrowDown, ArrowUp } from "lucide-react";

export default async function AdminQuestionBankAreaPage({
  params,
  searchParams,
}: {
  params: Promise<{ riskAreaId: string }>;
  searchParams: Promise<{ type?: string }>;
}) {
  await requireAdminRole();
  const { riskAreaId } = await params;
  const { type: typeParam } = await searchParams;
  const typeFilter = isQuestionBankFilterType(typeParam) ? typeParam : undefined;
  const typeQuery = typeFilter ? `?type=${encodeURIComponent(typeFilter)}` : "";

  const legacy = legacyRiskAreaRedirect(riskAreaId);
  if (legacy) {
    redirect(`/admin/question-bank/${legacy}${typeQuery}`);
  }

  if (!isRiskAreaId(riskAreaId)) {
    notFound();
  }

  const area = RISK_AREAS.find((a) => a.id === riskAreaId)!;

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
        <Button size="sm" asChild>
          <Link href={`/admin/question-bank/${riskAreaId}/new`}>New question</Link>
        </Button>
        <Suspense fallback={null}>
          <div className="flex flex-wrap items-center gap-4 border-l border-border pl-4">
            <QuestionBankRiskAreaFilter activeAreaId={riskAreaId} />
            <QuestionBankTypeFilter />
          </div>
        </Suspense>
      </div>

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
            Live bank: Belvedere pillar DDL (<code className="text-xs">questions</code>). Create,
            edit, hide, reorder, and delete apply directly to new assessments.
          </p>
        </CardHeader>
        <CardContent className="space-y-0 divide-y divide-border p-0">
          {questions.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">
              No questions in the bank for this area. Run{" "}
              <code className="text-xs">npm run seed:pillar-ddl</code> first.
            </p>
          ) : filteredQuestions.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">
              No questions match this type filter. Choose &quot;All types&quot; or pick another
              question type.
            </p>
          ) : (
            filteredQuestions.map((q, index) => (
              <div
                key={q.questionId}
                className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between"
              >
                <div className="min-w-0 space-y-1 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <code className="text-xs text-muted-foreground">{q.questionId}</code>
                    <Badge variant={q.isVisible ? "success" : "secondary"}>
                      {q.isVisible ? "Visible" : "Hidden"}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {q.type} · weight {q.weight}
                      {q.required ? " · required" : " · optional"}
                    </span>
                  </div>
                  <p className="text-sm font-medium leading-snug">{q.text}</p>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  <div className="flex gap-1">
                    <form action={movePillarQuestionOrder}>
                      <input type="hidden" name="questionId" value={q.questionId} />
                      <input type="hidden" name="riskAreaId" value={riskAreaId} />
                      <input type="hidden" name="direction" value="up" />
                      <Button
                        type="submit"
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        disabled={index === 0 || reorderDisabled}
                        aria-label="Move up"
                      >
                        <ArrowUp className="size-4" />
                      </Button>
                    </form>
                    <form action={movePillarQuestionOrder}>
                      <input type="hidden" name="questionId" value={q.questionId} />
                      <input type="hidden" name="riskAreaId" value={riskAreaId} />
                      <input type="hidden" name="direction" value="down" />
                      <Button
                        type="submit"
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        disabled={index === filteredQuestions.length - 1 || reorderDisabled}
                        aria-label="Move down"
                      >
                        <ArrowDown className="size-4" />
                      </Button>
                    </form>
                  </div>
                  <form action={updatePillarQuestionVisibility}>
                    <input type="hidden" name="questionId" value={q.questionId} />
                    <input type="hidden" name="riskAreaId" value={riskAreaId} />
                    <input type="hidden" name="isVisible" value={q.isVisible ? "false" : "true"} />
                    <Button type="submit" variant="outline" size="sm">
                      {q.isVisible ? "Hide" : "Show"}
                    </Button>
                  </form>
                  <Button variant="default" size="sm" asChild>
                    <Link
                      href={`/admin/question-bank/${riskAreaId}/${encodeURIComponent(q.questionId)}${typeQuery}`}
                    >
                      Edit
                    </Link>
                  </Button>
                  <DeleteQuestionBankButton
                    formAction={deletePillarQuestion}
                    questionId={q.questionId}
                    extraHidden={[{ name: "riskAreaId", value: riskAreaId }]}
                  />
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

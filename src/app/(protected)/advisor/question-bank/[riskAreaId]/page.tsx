import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { RISK_AREAS } from "@/lib/advisor/types";
import { isRiskAreaId, legacyRiskAreaRedirect } from "@/lib/assessment/bank/risk-areas";
import { loadQuestionBankDashboardRows } from "@/lib/assessment/bank/question-bank-dashboard";
import { formatQuestionTextForDisplay } from "@/lib/assessment/bank/question-bank-display";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function AdvisorQuestionBankAreaPage({
  params,
}: {
  params: Promise<{ riskAreaId: string }>;
}) {
  const { riskAreaId } = await params;

  // F2 / BRD §4.1 — old bookmark URL? 302 to the current ID instead of 404.
  const legacy = legacyRiskAreaRedirect(riskAreaId);
  if (legacy) {
    redirect(`/advisor/question-bank/${legacy}`);
  }

  if (!isRiskAreaId(riskAreaId)) {
    notFound();
  }

  const area = RISK_AREAS.find((a) => a.id === riskAreaId)!;

  const questions = await loadQuestionBankDashboardRows(riskAreaId);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="outline" size="sm" asChild>
          <Link href="/advisor/intelligence">Risk intelligence</Link>
        </Button>
      </div>

      <div className="space-y-1">
        <h2 className="text-lg font-semibold tracking-tight">Question bank</h2>
        <p className="text-sm text-muted-foreground">{area.name}</p>
        <p className="text-sm text-muted-foreground max-w-2xl">{area.summary}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {questions.length} question{questions.length === 1 ? "" : "s"}
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Read-only view of assessment questions for this risk area. Contact your platform admin
            to edit question copy.
          </p>
        </CardHeader>
        <CardContent className="space-y-6 p-6 pt-0">
          {questions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No questions seeded for this area yet.</p>
          ) : (
            <ol className="list-decimal space-y-6 pl-5 marker:text-muted-foreground">
              {questions.map((q) => (
                <li key={q.questionId} className="space-y-2 pl-1">
                  <Badge
                    variant={q.isVisible ? "success" : "secondary"}
                    className="mb-1"
                  >
                    {q.isVisible ? "Visible to clients" : "Hidden"}
                  </Badge>
                  <p className="text-sm font-medium leading-relaxed text-foreground">
                    {formatQuestionTextForDisplay(q.text)}
                  </p>
                  {q.helpText ? (
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      {formatQuestionTextForDisplay(q.helpText)}
                    </p>
                  ) : null}
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

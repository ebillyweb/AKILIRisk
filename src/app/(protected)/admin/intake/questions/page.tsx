import Link from "next/link";
import { getIntakeScriptQuestionsForAdmin } from "@/lib/admin/intake-questions-queries";
import { setIntakePillarQuestionVisibility } from "@/lib/actions/admin-intake-questions-actions";
import { formatQuestionTextForDisplay } from "@/lib/assessment/bank/question-bank-display";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function AdminIntakeQuestionsPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string }>;
}) {
  const sp = await searchParams;
  const showSaved = sp.saved === "1";
  const questions = await getIntakeScriptQuestionsForAdmin();

  return (
    <div className="space-y-6">
      {showSaved ? (
        <Alert variant="success">
          <AlertTitle>Saved</AlertTitle>
          <AlertDescription>Changes are live for new interview loads.</AlertDescription>
        </Alert>
      ) : null}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
        <Button variant="outline" size="sm" asChild>
          <Link href="/admin/intake">Back to intake interviews</Link>
        </Button>
      </div>

      {questions.length === 0 ? (
        <Alert>
          <AlertTitle>No intake questions yet</AlertTitle>
          <AlertDescription>
            No intake questions are configured yet. Run the intake bank seed (`npm run seed:pillar-ddl`)
            or add intake questions in the database to manage the live interview here. Until then,
            clients hear the built-in fallback list.
          </AlertDescription>
        </Alert>
      ) : (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              Script questions{" "}
              <span className="font-normal text-muted-foreground">({questions.length})</span>
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Order matches the live interview. Hidden questions are skipped for clients.
            </p>
          </CardHeader>
          <CardContent className="space-y-0 divide-y divide-border p-0" data-tour="config-primary-list">
            {questions.map((q) => (
              <div
                key={q.id}
                className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between"
              >
                <div className="min-w-0 flex-1 space-y-2">
                  <p className="text-sm font-medium leading-relaxed text-foreground">
                    {formatQuestionTextForDisplay(q.questionText)}
                  </p>
                  {q.whyThisMatters?.trim() ? (
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      {formatQuestionTextForDisplay(q.whyThisMatters)}
                    </p>
                  ) : null}
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
                  <Badge variant={q.isVisible ? "success" : "secondary"} className="shrink-0">
                    {q.isVisible ? "Visible" : "Hidden"}
                  </Badge>
                  <form action={setIntakePillarQuestionVisibility}>
                    <input type="hidden" name="questionId" value={q.id} />
                    <input type="hidden" name="setVisible" value={q.isVisible ? "0" : "1"} />
                    <Button type="submit" variant="outline" size="sm">
                      {q.isVisible ? "Hide" : "Show"}
                    </Button>
                  </form>
                  <Button variant="default" size="sm" asChild>
                    <Link href={`/admin/intake/questions/${q.id}/edit`}>Edit</Link>
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

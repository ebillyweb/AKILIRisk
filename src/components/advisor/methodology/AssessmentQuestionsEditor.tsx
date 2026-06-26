"use client";

import { useTransition } from "react";
import type { AdvisorQuestionSource } from "@prisma/client";
import {
  createAdvisorPillarQuestion,
  deleteAdvisorPillarQuestion,
  updateAdvisorPillarQuestion,
} from "@/lib/actions/methodology-actions";
import { FieldHelp, LabelWithHelp } from "@/components/ui/field-help";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

type AssessmentQuestionRow = {
  id: string;
  sourceKind: AdvisorQuestionSource;
  questionNumber: string | null;
  questionText: string;
  whyThisMatters: string | null;
  recommendedActions: string | null;
  isVisible: boolean;
};

export function AssessmentQuestionsEditor({
  pillarSlug,
  questions,
}: {
  pillarSlug: string;
  questions: AssessmentQuestionRow[];
}) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="space-y-4">
      {questions.map((q) => (
        <Card key={q.id} className={!q.isVisible ? "opacity-70" : undefined}>
          <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
            <div className="space-y-1">
              <CardTitle className="text-base">
                {q.questionNumber ? `Question ${q.questionNumber}` : "Question"}
              </CardTitle>
              <Badge variant={q.sourceKind === "CUSTOM" ? "secondary" : "outline"}>
                {q.sourceKind === "CUSTOM" ? "Custom" : "Platform base"}
              </Badge>
            </div>
            {q.sourceKind === "CUSTOM" ? (
              <Button
                type="button"
                variant="destructive"
                size="sm"
                disabled={pending}
                onClick={() => {
                  if (!window.confirm("Remove this custom question?")) return;
                  startTransition(async () => {
                    await deleteAdvisorPillarQuestion(q.id);
                  });
                }}
              >
                Delete
              </Button>
            ) : null}
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2">
              <Checkbox
                defaultChecked={q.isVisible}
                onCheckedChange={(checked) => {
                  startTransition(async () => {
                    await updateAdvisorPillarQuestion(q.id, {
                      isVisible: checked === true,
                    });
                  });
                }}
              />
              <Label>Visible in assessments</Label>
              <FieldHelp helpKey="advisor-assessment-visible" triggerLabel="Visible in assessments" />
            </div>
            <form
              className="space-y-3"
              action={(formData) => {
                startTransition(async () => {
                  await updateAdvisorPillarQuestion(q.id, {
                    questionText:
                      formData.get("questionText")?.toString() ?? q.questionText,
                    whyThisMatters:
                      formData.get("whyThisMatters")?.toString() || null,
                    recommendedActions:
                      formData.get("recommendedActions")?.toString() || null,
                  });
                });
              }}
            >
              <div className="space-y-2">
                <LabelWithHelp helpKey="advisor-assessment-question-text">Question text</LabelWithHelp>
                <Textarea name="questionText" defaultValue={q.questionText} rows={3} />
              </div>
              <div className="space-y-2">
                <LabelWithHelp helpKey="advisor-assessment-why-matters">Why this matters</LabelWithHelp>
                <Textarea
                  name="whyThisMatters"
                  defaultValue={q.whyThisMatters ?? ""}
                  placeholder="Why this matters"
                  rows={2}
                />
              </div>
              <div className="space-y-2">
                <LabelWithHelp helpKey="advisor-assessment-actions">Recommended actions</LabelWithHelp>
                <Textarea
                  name="recommendedActions"
                  defaultValue={q.recommendedActions ?? ""}
                  placeholder="Recommended actions"
                  rows={2}
                />
              </div>
              <Button type="submit" size="sm" disabled={pending}>
                Save
              </Button>
            </form>
          </CardContent>
        </Card>
      ))}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Add custom question</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-3 text-sm text-muted-foreground">
            Custom questions apply to new intakes only and are visible only to your clients.
            Platform base questions can be edited or hidden but not removed.
          </p>
          <form
            className="space-y-3"
            action={(formData) => {
              startTransition(async () => {
                const questionText = formData.get("questionText")?.toString() ?? "";
                await createAdvisorPillarQuestion(pillarSlug, {
                  questionText,
                  whyThisMatters: formData.get("whyThisMatters")?.toString() || null,
                  recommendedActions:
                    formData.get("recommendedActions")?.toString() || null,
                });
              });
            }}
          >
            <div className="space-y-2">
              <LabelWithHelp helpKey="advisor-assessment-question-text">Question text</LabelWithHelp>
              <Textarea name="questionText" placeholder="Question text" rows={3} required />
            </div>
            <div className="space-y-2">
              <LabelWithHelp helpKey="advisor-assessment-why-matters">Why this matters (optional)</LabelWithHelp>
              <Textarea name="whyThisMatters" placeholder="Why this matters (optional)" rows={2} />
            </div>
            <div className="space-y-2">
              <LabelWithHelp helpKey="advisor-assessment-actions">Recommended actions (optional)</LabelWithHelp>
              <Textarea
                name="recommendedActions"
                placeholder="Recommended actions (optional)"
                rows={2}
              />
            </div>
            <Button type="submit" size="sm" disabled={pending}>
              Add question
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

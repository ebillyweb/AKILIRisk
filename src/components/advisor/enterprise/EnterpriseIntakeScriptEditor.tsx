"use client";

import { useTransition } from "react";
import type { AdvisorQuestionSource } from "@prisma/client";
import {
  createEnterpriseIntakeQuestion,
  deleteEnterpriseIntakeQuestion,
  updateEnterpriseIntakeQuestion,
} from "@/lib/actions/enterprise-methodology-actions";
import { isEnterpriseAdvisorQuestion } from "@/lib/methodology/advisor-question-policy";
import { FieldHelp, LabelWithHelp } from "@/components/ui/field-help";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

type IntakeRow = {
  id: string;
  sourceKind: AdvisorQuestionSource;
  displayOrder: number;
  questionText: string;
  context: string | null;
  isVisible: boolean;
};

function sourceBadgeLabel(sourceKind: AdvisorQuestionSource): string {
  if (sourceKind === "CUSTOM") return "Custom";
  if (isEnterpriseAdvisorQuestion(sourceKind)) return "Firm default";
  return "Platform base";
}

export function EnterpriseIntakeScriptEditor({ questions }: { questions: IntakeRow[] }) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="space-y-4">
      {questions.map((q, index) => (
        <Card key={q.id} className={!q.isVisible ? "opacity-70" : undefined}>
          <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
            <div className="space-y-1">
              <CardTitle className="text-base">Question {index + 1}</CardTitle>
              <Badge variant={q.sourceKind === "CUSTOM" ? "secondary" : "outline"}>
                {sourceBadgeLabel(q.sourceKind)}
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
                    await deleteEnterpriseIntakeQuestion(q.id);
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
                    await updateEnterpriseIntakeQuestion(q.id, {
                      isVisible: checked === true,
                    });
                  });
                }}
              />
              <Label>Visible to clients</Label>
              <FieldHelp helpKey="advisor-intake-visible" triggerLabel="Visible to clients" />
            </div>
            <form
              className="space-y-3"
              action={(formData) => {
                startTransition(async () => {
                  await updateEnterpriseIntakeQuestion(q.id, {
                    questionText: formData.get("questionText")?.toString() ?? q.questionText,
                    context: formData.get("context")?.toString() ?? null,
                  });
                });
              }}
            >
              <div className="space-y-2">
                <LabelWithHelp helpKey="advisor-intake-question-text">Question text</LabelWithHelp>
                <Textarea name="questionText" defaultValue={q.questionText} rows={3} />
              </div>
              <div className="space-y-2">
                <LabelWithHelp helpKey="advisor-intake-context">Context / coaching prompt</LabelWithHelp>
                <Textarea
                  name="context"
                  defaultValue={q.context ?? ""}
                  placeholder="Context / coaching prompt"
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
          <CardTitle className="text-base">Add custom intake question</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-3 text-sm text-muted-foreground">
            Firm-wide custom questions sync to all member advisors. Platform base questions can be
            edited or hidden but not removed.
          </p>
          <form
            className="space-y-3"
            action={(formData) => {
              startTransition(async () => {
                await createEnterpriseIntakeQuestion({
                  questionText: formData.get("questionText")?.toString() ?? "",
                  context: formData.get("context")?.toString() || null,
                });
              });
            }}
          >
            <div className="space-y-2">
              <LabelWithHelp helpKey="advisor-intake-question-text">Question text</LabelWithHelp>
              <Textarea name="questionText" placeholder="Question text" rows={3} required />
            </div>
            <div className="space-y-2">
              <LabelWithHelp helpKey="advisor-intake-context">Context / coaching prompt (optional)</LabelWithHelp>
              <Textarea name="context" placeholder="Context / coaching prompt (optional)" rows={2} />
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

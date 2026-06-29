"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import type { AdvisorQuestionSource } from "@prisma/client";
import {
  createAdvisorPillarQuestion,
  deleteAdvisorPillarQuestion,
  updateAdvisorPillarQuestion,
} from "@/lib/actions/methodology-actions";
import { isEnterpriseAdvisorQuestion } from "@/lib/methodology/advisor-question-policy";
import {
  labelForAdvisorAssessmentAnswerType,
  readAdvisorAssessmentQuestionForm,
} from "@/lib/methodology/advisor-assessment-question-config";
import { AssessmentQuestionAnswerFields } from "@/components/advisor/methodology/AssessmentQuestionAnswerFields";
import { FieldHelp, LabelWithHelp } from "@/components/ui/field-help";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export type AssessmentQuestionRow = {
  id: string;
  sourceKind: AdvisorQuestionSource;
  questionNumber: string | null;
  questionText: string;
  answerType: string;
  answer0: string | null;
  answer1: string | null;
  answer2: string | null;
  answer3: string | null;
  whyThisMatters: string | null;
  recommendedActions: string | null;
  isVisible: boolean;
};

type AssessmentQuestionActions = {
  updateQuestion: typeof updateAdvisorPillarQuestion;
  createQuestion: typeof createAdvisorPillarQuestion;
  deleteQuestion: typeof deleteAdvisorPillarQuestion;
};

const defaultActions: AssessmentQuestionActions = {
  updateQuestion: updateAdvisorPillarQuestion,
  createQuestion: createAdvisorPillarQuestion,
  deleteQuestion: deleteAdvisorPillarQuestion,
};

function sourceBadgeLabel(sourceKind: AdvisorQuestionSource): string {
  if (sourceKind === "CUSTOM") return "Custom";
  if (isEnterpriseAdvisorQuestion(sourceKind)) return "Firm default";
  return "Platform base";
}

function isCustomQuestion(sourceKind: AdvisorQuestionSource): boolean {
  return sourceKind === "CUSTOM";
}

type MutationHandlers = {
  handleMutationResult: (
    result: { success: boolean; error?: string },
    successMessage: string,
    onSuccess?: () => void,
  ) => void;
  refreshAfterSuccess: (onSuccess?: () => void) => void;
};

function QuestionCard({
  q,
  pending,
  actions,
  runPending,
  handleMutationResult,
  refreshAfterSuccess,
}: {
  q: AssessmentQuestionRow;
  pending: boolean;
  actions: AssessmentQuestionActions;
  runPending: (fn: () => Promise<void>) => void;
  handleMutationResult: MutationHandlers["handleMutationResult"];
  refreshAfterSuccess: MutationHandlers["refreshAfterSuccess"];
}) {
  const isCustom = isCustomQuestion(q.sourceKind);

  return (
    <Card className={!q.isVisible ? "opacity-70" : undefined}>
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div className="space-y-1">
          <CardTitle className="text-base">
            {q.questionNumber ? `Question ${q.questionNumber}` : "Question"}
          </CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={isCustom ? "secondary" : "outline"}>
              {sourceBadgeLabel(q.sourceKind)}
            </Badge>
            {!isCustom ? (
              <Badge variant="outline">
                {labelForAdvisorAssessmentAnswerType(q.answerType)}
              </Badge>
            ) : null}
          </div>
        </div>
        {isCustom ? (
          <Button
            type="button"
            variant="destructive"
            size="sm"
            disabled={pending}
            onClick={() => {
              if (!window.confirm("Remove this custom question?")) return;
              runPending(async () => {
                const result = await actions.deleteQuestion(q.id);
                handleMutationResult(result, "Custom question removed");
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
              runPending(async () => {
                const result = await actions.updateQuestion(q.id, {
                  isVisible: checked === true,
                });
                if (!result.success) {
                  toast.error(result.error ?? "Failed to update visibility");
                  return;
                }
                refreshAfterSuccess();
              });
            }}
          />
          <Label>Visible in assessments</Label>
          <FieldHelp helpKey="advisor-assessment-visible" triggerLabel="Visible in assessments" />
        </div>
        <form
          className="space-y-3"
          action={(formData) => {
            runPending(async () => {
              const payload = readAdvisorAssessmentQuestionForm(formData);
              const result = await actions.updateQuestion(q.id, {
                questionText: payload.questionText || q.questionText,
                whyThisMatters: payload.whyThisMatters,
                recommendedActions: payload.recommendedActions,
                ...(isCustom
                  ? {
                      answerType: payload.answerType,
                      answer0: payload.answer0,
                      answer1: payload.answer1,
                      answer2: payload.answer2,
                      answer3: payload.answer3,
                    }
                  : {}),
              });
              handleMutationResult(result, "Question saved");
            });
          }}
        >
          <div className="space-y-2">
            <LabelWithHelp helpKey="advisor-assessment-question-text">Question text</LabelWithHelp>
            <Textarea name="questionText" defaultValue={q.questionText} rows={3} />
          </div>
          {isCustom ? (
            <AssessmentQuestionAnswerFields
              idPrefix={`${q.id}-`}
              defaultAnswerType={q.answerType}
              defaultAnswer0={q.answer0}
              defaultAnswer1={q.answer1}
              defaultAnswer2={q.answer2}
              defaultAnswer3={q.answer3}
            />
          ) : (
            <AssessmentQuestionAnswerFields readOnly defaultAnswerType={q.answerType} />
          )}
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
  );
}

function QuestionsList({
  questions,
  pending,
  actions,
  runPending,
  emptyMessage,
  handleMutationResult,
  refreshAfterSuccess,
}: {
  questions: AssessmentQuestionRow[];
  pending: boolean;
  actions: AssessmentQuestionActions;
  runPending: (fn: () => Promise<void>) => void;
  emptyMessage: string;
  handleMutationResult: MutationHandlers["handleMutationResult"];
  refreshAfterSuccess: MutationHandlers["refreshAfterSuccess"];
}) {
  if (questions.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyMessage}</p>;
  }

  return (
    <div className="space-y-4">
      {questions.map((q) => (
        <QuestionCard
          key={q.id}
          q={q}
          pending={pending}
          actions={actions}
          runPending={runPending}
          handleMutationResult={handleMutationResult}
          refreshAfterSuccess={refreshAfterSuccess}
        />
      ))}
    </div>
  );
}

function CreateQuestionCard({
  pillarSlug,
  pending,
  createFormKey,
  createDescription,
  actions,
  runPending,
  handleMutationResult,
  onCreated,
}: {
  pillarSlug: string;
  pending: boolean;
  createFormKey: number;
  createDescription: string;
  actions: AssessmentQuestionActions;
  runPending: (fn: () => Promise<void>) => void;
  handleMutationResult: MutationHandlers["handleMutationResult"];
  onCreated: () => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Add custom question</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="mb-3 text-sm text-muted-foreground">{createDescription}</p>
        <form
          key={createFormKey}
          className="space-y-3"
          action={(formData) => {
            runPending(async () => {
              const result = await actions.createQuestion(
                pillarSlug,
                readAdvisorAssessmentQuestionForm(formData),
              );
              handleMutationResult(result, "Custom question added", onCreated);
            });
          }}
        >
          <div className="space-y-2">
            <LabelWithHelp helpKey="advisor-assessment-question-text">Question text</LabelWithHelp>
            <Textarea name="questionText" placeholder="Question text" rows={3} required />
          </div>
          <AssessmentQuestionAnswerFields idPrefix="create-" />
          <div className="space-y-2">
            <LabelWithHelp helpKey="advisor-assessment-why-matters">
              Why this matters (optional)
            </LabelWithHelp>
            <Textarea name="whyThisMatters" placeholder="Why this matters (optional)" rows={2} />
          </div>
          <div className="space-y-2">
            <LabelWithHelp helpKey="advisor-assessment-actions">
              Recommended actions (optional)
            </LabelWithHelp>
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
  );
}

export function AssessmentQuestionsEditor({
  pillarSlug,
  questions,
  actions = defaultActions,
  createDescription = "Custom questions apply to new intakes only and are visible only to your clients. Platform questions can be edited or hidden but not removed.",
  stockDescription = "Platform questions ship with AkiliRisk. Edit or hide them for your clients — they cannot be deleted. Firm defaults also appear here when your organization provides them.",
}: {
  pillarSlug: string;
  questions: AssessmentQuestionRow[];
  actions?: AssessmentQuestionActions;
  createDescription?: string;
  stockDescription?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [createFormKey, setCreateFormKey] = useState(0);

  const refreshAfterSuccess = (onSuccess?: () => void) => {
    onSuccess?.();
    startTransition(() => router.refresh());
  };

  const handleMutationResult = (
    result: { success: boolean; error?: string },
    successMessage: string,
    onSuccess?: () => void,
  ) => {
    if (!result.success) {
      toast.error(result.error ?? "Something went wrong");
      return;
    }
    toast.success(successMessage);
    refreshAfterSuccess(onSuccess);
  };

  const stockQuestions = questions.filter((q) => !isCustomQuestion(q.sourceKind));
  const customQuestions = questions.filter((q) => isCustomQuestion(q.sourceKind));

  const runPending = (fn: () => Promise<void>) => {
    startTransition(async () => {
      await fn();
    });
  };

  const listProps = {
    pending,
    actions,
    runPending,
    handleMutationResult,
    refreshAfterSuccess,
  };

  return (
    <Tabs defaultValue="platform" className="gap-4" data-tour="questions-existing">
      <TabsList variant="line" className="w-full justify-start">
        <TabsTrigger value="platform">
          Platform
          <Badge variant="secondary" className="ml-1.5 px-1.5 py-0 text-xs">
            {stockQuestions.length}
          </Badge>
        </TabsTrigger>
        <TabsTrigger value="custom">
          Custom
          <Badge variant="secondary" className="ml-1.5 px-1.5 py-0 text-xs">
            {customQuestions.length}
          </Badge>
        </TabsTrigger>
      </TabsList>

      <TabsContent value="platform" className="mt-0 space-y-4">
        <p className="text-sm text-muted-foreground">{stockDescription}</p>
        <QuestionsList
          {...listProps}
          questions={stockQuestions}
          emptyMessage="No platform questions for this pillar yet. Check back after defaults sync, or add a custom question."
        />
      </TabsContent>

      <TabsContent value="custom" className="mt-0 space-y-4">
        <QuestionsList
          {...listProps}
          questions={customQuestions}
          emptyMessage="No custom questions for this pillar yet."
        />
        <CreateQuestionCard
          pillarSlug={pillarSlug}
          pending={pending}
          createFormKey={createFormKey}
          createDescription={createDescription}
          actions={actions}
          runPending={runPending}
          handleMutationResult={handleMutationResult}
          onCreated={() => setCreateFormKey((key) => key + 1)}
        />
      </TabsContent>
    </Tabs>
  );
}

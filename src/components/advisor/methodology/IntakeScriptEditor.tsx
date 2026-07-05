"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import type { AdvisorQuestionSource, IntakeQuestionBankMode } from "@prisma/client";
import {
  createAdvisorIntakeQuestion,
  deleteAdvisorIntakeQuestion,
  updateAdvisorIntakeQuestion,
  updateAdvisorIntakeQuestionBankMode,
} from "@/lib/actions/methodology-actions";
import { isEnterpriseAdvisorQuestion } from "@/lib/methodology/advisor-question-policy";
import {
  filterIntakeQuestionsByBankMode,
  isCustomIntakeQuestionSource,
} from "@/lib/methodology/intake-question-bank-mode";
import { labelForAdvisorAssessmentAnswerType } from "@/lib/methodology/advisor-intake-question-config";
import { readAdvisorIntakeQuestionForm } from "@/lib/methodology/advisor-intake-question-config";
import { AssessmentQuestionAnswerFields } from "@/components/advisor/methodology/AssessmentQuestionAnswerFields";
import { FieldHelp, LabelWithHelp } from "@/components/ui/field-help";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

export type IntakeQuestionRow = {
  id: string;
  sourceKind: AdvisorQuestionSource;
  displayOrder: number;
  questionText: string;
  context: string | null;
  isVisible: boolean;
  answerType: string;
  answer0: string | null;
  answer1: string | null;
  answer2: string | null;
  answer3: string | null;
};

type IntakeQuestionActions = {
  updateQuestion: typeof updateAdvisorIntakeQuestion;
  createQuestion: typeof createAdvisorIntakeQuestion;
  deleteQuestion: typeof deleteAdvisorIntakeQuestion;
  updateBankMode: typeof updateAdvisorIntakeQuestionBankMode;
};

const defaultActions: IntakeQuestionActions = {
  updateQuestion: updateAdvisorIntakeQuestion,
  createQuestion: createAdvisorIntakeQuestion,
  deleteQuestion: deleteAdvisorIntakeQuestion,
  updateBankMode: updateAdvisorIntakeQuestionBankMode,
};

function sourceBadgeLabel(sourceKind: AdvisorQuestionSource): string {
  if (sourceKind === "CUSTOM") return "Custom";
  if (isEnterpriseAdvisorQuestion(sourceKind)) return "Firm default";
  return "Platform base";
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
  index,
  pending,
  actions,
  runPending,
  handleMutationResult,
  refreshAfterSuccess,
  canDelete,
}: {
  q: IntakeQuestionRow;
  index: number;
  pending: boolean;
  actions: IntakeQuestionActions;
  runPending: (fn: () => Promise<void>) => void;
  handleMutationResult: MutationHandlers["handleMutationResult"];
  refreshAfterSuccess: MutationHandlers["refreshAfterSuccess"];
  canDelete: boolean;
}) {
  const isCustom = isCustomIntakeQuestionSource(q.sourceKind);

  return (
    <Card key={q.id} className={!q.isVisible ? "opacity-70" : undefined}>
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div className="space-y-1">
          <CardTitle className="text-base">Question {index + 1}</CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={isCustom ? "secondary" : "outline"}>
              {sourceBadgeLabel(q.sourceKind)}
            </Badge>
            <Badge variant="outline">{labelForAdvisorAssessmentAnswerType(q.answerType)}</Badge>
          </div>
        </div>
        {canDelete ? (
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
          <Label>Visible to clients</Label>
          <FieldHelp helpKey="advisor-intake-visible" triggerLabel="Visible to clients" />
        </div>
        <form
          className="space-y-3"
          action={(formData) => {
            runPending(async () => {
              const payload = readAdvisorIntakeQuestionForm(formData);
              const result = await actions.updateQuestion(q.id, payload);
              handleMutationResult(result, "Question saved");
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
          {isCustom ? (
            <AssessmentQuestionAnswerFields
              defaultAnswerType={q.answerType}
              defaultAnswer0={q.answer0}
              defaultAnswer1={q.answer1}
              defaultAnswer2={q.answer2}
              defaultAnswer3={q.answer3}
            />
          ) : (
            <AssessmentQuestionAnswerFields readOnly defaultAnswerType={q.answerType} />
          )}
          <Button type="submit" size="sm" disabled={pending}>
            Save
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function CreateQuestionCard({
  pending,
  createFormKey,
  createDescription,
  actions,
  runPending,
  handleMutationResult,
  onCreated,
}: {
  pending: boolean;
  createFormKey: number;
  createDescription: string;
  actions: IntakeQuestionActions;
  runPending: (fn: () => Promise<void>) => void;
  handleMutationResult: MutationHandlers["handleMutationResult"];
  onCreated: () => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Add custom intake question</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="mb-3 text-sm text-muted-foreground">{createDescription}</p>
        <form
          key={createFormKey}
          className="space-y-3"
          action={(formData) => {
            runPending(async () => {
              const payload = readAdvisorIntakeQuestionForm(formData);
              const result = await actions.createQuestion(payload);
              handleMutationResult(result, "Custom question added", onCreated);
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
          <AssessmentQuestionAnswerFields idPrefix="create-" />
          <Button type="submit" size="sm" disabled={pending}>
            Add question
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

export function IntakeScriptEditor({
  questions,
  bankMode,
  modeReadOnly = false,
  modeManagedByFirm = false,
  actions = defaultActions,
  createDescription = "Custom questions apply to new intakes only. Switch back to platform anytime — your custom set is saved.",
  platformDescription = "Use AkiliRisk platform intake questions. Edit or hide individual prompts — they cannot be deleted.",
  customDescription = "Build your own intake question set. Platform questions are not included while custom mode is active.",
}: {
  questions: IntakeQuestionRow[];
  bankMode: IntakeQuestionBankMode;
  modeReadOnly?: boolean;
  modeManagedByFirm?: boolean;
  actions?: IntakeQuestionActions;
  createDescription?: string;
  platformDescription?: string;
  customDescription?: string;
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

  const activeQuestions = filterIntakeQuestionsByBankMode(questions, bankMode);
  const isCustomMode = bankMode === "CUSTOM";

  const runPending = (fn: () => Promise<void>) => {
    startTransition(async () => {
      await fn();
    });
  };

  return (
    <div className="space-y-4" data-tour="intake-questions">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Question bank source</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Choose one source for client intake interviews. Platform and custom question banks are
            not combined.
          </p>
          {modeManagedByFirm ? (
            <p className="text-sm text-muted-foreground">
              This setting is managed in firm Practice Standards.
            </p>
          ) : null}
          <RadioGroup
            value={bankMode}
            disabled={pending || modeReadOnly}
            onValueChange={(value) => {
              if (value !== "PLATFORM" && value !== "CUSTOM") return;
              runPending(async () => {
                const result = await actions.updateBankMode(value);
                handleMutationResult(
                  result,
                  value === "CUSTOM"
                    ? "Switched to custom question bank"
                    : "Switched to platform question bank",
                );
              });
            }}
            className="grid gap-3 sm:grid-cols-2"
          >
            <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border p-4 has-[:checked]:border-primary has-[:checked]:bg-primary/5">
              <RadioGroupItem value="PLATFORM" className="mt-0.5" />
              <div className="space-y-1">
                <p className="text-sm font-medium">Platform question bank</p>
                <p className="text-sm text-muted-foreground">
                  AkiliRisk catalog questions for your clients.
                </p>
              </div>
            </label>
            <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border p-4 has-[:checked]:border-primary has-[:checked]:bg-primary/5">
              <RadioGroupItem value="CUSTOM" className="mt-0.5" />
              <div className="space-y-1">
                <p className="text-sm font-medium">Custom question bank</p>
                <p className="text-sm text-muted-foreground">
                  Your own intake prompts only.
                </p>
              </div>
            </label>
          </RadioGroup>
        </CardContent>
      </Card>

      <p className="text-sm text-muted-foreground">
        {isCustomMode ? customDescription : platformDescription}
      </p>

      {activeQuestions.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {isCustomMode
            ? "No custom intake questions yet. Add your first question below."
            : "No platform intake questions yet. Check back after defaults sync."}
        </p>
      ) : (
        <div className="space-y-4">
          {activeQuestions.map((q, index) => (
            <QuestionCard
              key={q.id}
              q={q}
              index={index}
              pending={pending}
              actions={actions}
              runPending={runPending}
              handleMutationResult={handleMutationResult}
              refreshAfterSuccess={refreshAfterSuccess}
              canDelete={isCustomMode && isCustomIntakeQuestionSource(q.sourceKind)}
            />
          ))}
        </div>
      )}

      {isCustomMode ? (
        <CreateQuestionCard
          pending={pending}
          createFormKey={createFormKey}
          createDescription={createDescription}
          actions={actions}
          runPending={runPending}
          handleMutationResult={handleMutationResult}
          onCreated={() => setCreateFormKey((key) => key + 1)}
        />
      ) : null}
    </div>
  );
}

"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import type { AdvisorQuestionSource, IntakeQuestionBankMode } from "@prisma/client";
import {
  createAdvisorPillarQuestion,
  deleteAdvisorPillarQuestion,
  updateAdvisorAssessmentQuestionBankMode,
  updateAdvisorPillarQuestion,
} from "@/lib/actions/methodology-actions";
import { isEnterpriseAdvisorQuestion } from "@/lib/methodology/advisor-question-policy";
import {
  customOnlyEmptyBankMessage,
  filterAndOrderQuestionsByBankMode,
  isCustomIntakeQuestionSource,
} from "@/lib/methodology/intake-question-bank-mode";
import {
  labelForAdvisorAssessmentAnswerType,
  readAdvisorAssessmentQuestionForm,
} from "@/lib/methodology/advisor-assessment-question-config";
import { AssessmentQuestionAnswerFields } from "@/components/advisor/methodology/AssessmentQuestionAnswerFields";
import { SwitchToCombinedQuestionBankDialog } from "@/components/advisor/methodology/SwitchToCustomQuestionBankDialog";
import {
  QuestionBankModeControls,
  QuestionBankModeStatusBanner,
  CustomOnlyEmptyBankNotice,
  canDeleteCustomQuestionInBankMode,
  questionBankModeChangeMessage,
  questionBankModeDescription,
} from "@/components/advisor/methodology/QuestionBankModeControls";
import { FieldHelp, LabelWithHelp } from "@/components/ui/field-help";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

export type AssessmentQuestionRow = {
  id: string;
  sourceKind: AdvisorQuestionSource;
  displayOrder: number;
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

type AssessmentQuestionFormPayload = ReturnType<typeof readAdvisorAssessmentQuestionForm>;

type AssessmentQuestionActions = {
  updateQuestion: typeof updateAdvisorPillarQuestion;
  createQuestion: typeof createAdvisorPillarQuestion;
  deleteQuestion: typeof deleteAdvisorPillarQuestion;
  updateBankMode: typeof updateAdvisorAssessmentQuestionBankMode;
};

const defaultActions: AssessmentQuestionActions = {
  updateQuestion: updateAdvisorPillarQuestion,
  createQuestion: createAdvisorPillarQuestion,
  deleteQuestion: deleteAdvisorPillarQuestion,
  updateBankMode: updateAdvisorAssessmentQuestionBankMode,
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
  pending,
  actions,
  runPending,
  handleMutationResult,
  refreshAfterSuccess,
  canDelete,
}: {
  q: AssessmentQuestionRow;
  pending: boolean;
  actions: AssessmentQuestionActions;
  runPending: (fn: () => Promise<void>) => void;
  handleMutationResult: MutationHandlers["handleMutationResult"];
  refreshAfterSuccess: MutationHandlers["refreshAfterSuccess"];
  canDelete: boolean;
}) {
  const isCustom = isCustomIntakeQuestionSource(q.sourceKind);

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
                if (!result.success) {
                  toast.error(result.error ?? "Something went wrong");
                  return;
                }
                if (result.switchedToPlatform) {
                  toast.success(customOnlyEmptyBankMessage("assessment"));
                } else {
                  toast.success("Custom question removed");
                }
                refreshAfterSuccess();
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

function CreateQuestionCard({
  pillarSlug,
  pending,
  createFormKey,
  isPlatformOnlyMode,
  savedCustomQuestionCount,
  firmScope,
  createDescription,
  actions,
  runPending,
  onCreateSuccess,
}: {
  pillarSlug: string;
  pending: boolean;
  createFormKey: number;
  isPlatformOnlyMode: boolean;
  savedCustomQuestionCount: number;
  firmScope: boolean;
  createDescription: string;
  actions: AssessmentQuestionActions;
  runPending: (fn: () => Promise<void>) => void;
  onCreateSuccess: (result: { switchedToCombinedBank?: boolean }) => void;
}) {
  const [switchDialogOpen, setSwitchDialogOpen] = useState(false);
  const [pendingPayload, setPendingPayload] = useState<AssessmentQuestionFormPayload | null>(null);

  const submitCreate = (payload: AssessmentQuestionFormPayload, switchToCombinedBank: boolean) => {
    runPending(async () => {
      const result = await actions.createQuestion(pillarSlug, {
        questionText: payload.questionText,
        whyThisMatters: payload.whyThisMatters,
        recommendedActions: payload.recommendedActions,
        answerType: payload.answerType,
        answer0: payload.answer0,
        answer1: payload.answer1,
        answer2: payload.answer2,
        answer3: payload.answer3,
        switchToCombinedBank,
      });
      if (!result.success) {
        toast.error(result.error ?? "Something went wrong");
        return;
      }
      setSwitchDialogOpen(false);
      setPendingPayload(null);
      onCreateSuccess({ switchedToCombinedBank: result.switchedToCombinedBank });
    });
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {isPlatformOnlyMode ? "Add custom assessment questions" : "Add custom assessment question"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-3 text-sm text-muted-foreground">
            {isPlatformOnlyMode
              ? "Add custom questions after your platform assessment set for this risk domain."
              : createDescription}
          </p>
          <form
            key={createFormKey}
            className="space-y-3"
            action={(formData) => {
              const payload = readAdvisorAssessmentQuestionForm(formData);
              if (!isPlatformOnlyMode) {
                submitCreate(payload, false);
                return;
              }
              setPendingPayload(payload);
              setSwitchDialogOpen(true);
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
              {isPlatformOnlyMode ? "Add custom question…" : "Add question"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <SwitchToCombinedQuestionBankDialog
        bankKind="assessment"
        open={switchDialogOpen}
        pending={pending}
        savedCustomQuestionCount={savedCustomQuestionCount}
        firmScope={firmScope}
        onOpenChange={(open) => {
          if (!pending) {
            setSwitchDialogOpen(open);
            if (!open) setPendingPayload(null);
          }
        }}
        onConfirm={() => {
          if (pendingPayload) {
            submitCreate(pendingPayload, true);
          }
        }}
      />
    </>
  );
}

export function AssessmentQuestionsEditor({
  pillarSlug,
  questions,
  bankMode,
  modeReadOnly = false,
  modeManagedByFirm = false,
  firmScope = false,
  totalCustomQuestionCount,
  actions = defaultActions,
  createDescription = "Custom questions apply to new assessments only. Switch bank mode anytime — your custom set is saved.",
  platformDescription = "Use AkiliRisk platform assessment questions. Edit or hide individual prompts — they cannot be deleted.",
  combinedDescription = "Platform assessment questions appear first, followed by your custom prompts for each risk domain.",
  customDescription = "Build your own assessment question set. Platform questions are not included while custom-only mode is active.",
}: {
  pillarSlug: string;
  questions: AssessmentQuestionRow[];
  bankMode: IntakeQuestionBankMode;
  modeReadOnly?: boolean;
  modeManagedByFirm?: boolean;
  firmScope?: boolean;
  totalCustomQuestionCount?: number;
  actions?: AssessmentQuestionActions;
  createDescription?: string;
  platformDescription?: string;
  combinedDescription?: string;
  customDescription?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [createFormKey, setCreateFormKey] = useState(0);
  const [highlightBankMode, setHighlightBankMode] = useState(false);
  const bankModeCardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!highlightBankMode) return;
    const timer = window.setTimeout(() => setHighlightBankMode(false), 4000);
    return () => window.clearTimeout(timer);
  }, [highlightBankMode]);

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

  const activeQuestions = filterAndOrderQuestionsByBankMode(questions, bankMode);
  const isPlatformOnlyMode = bankMode === "PLATFORM";
  const isCustomOnlyMode = bankMode === "CUSTOM";
  const savedCustomQuestionCount =
    totalCustomQuestionCount ??
    questions.filter((q) => isCustomIntakeQuestionSource(q.sourceKind)).length;
  const canAddCustomQuestions = !modeReadOnly;
  const canDeleteCustom = canDeleteCustomQuestionInBankMode(bankMode);

  const runPending = (fn: () => Promise<void>) => {
    startTransition(async () => {
      await fn();
    });
  };

  const handleCreateSuccess = (result: { switchedToCombinedBank?: boolean }) => {
    if (result.switchedToCombinedBank) {
      toast.success(
        firmScope
          ? "Custom assessment questions will now follow the firm platform set for new clients."
          : "Custom assessment questions will now follow your platform set for new clients.",
      );
      setHighlightBankMode(true);
      bankModeCardRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    } else {
      toast.success("Custom question added");
    }
    setCreateFormKey((key) => key + 1);
    refreshAfterSuccess();
  };

  return (
    <div className="space-y-4" data-tour="questions-existing">
      <QuestionBankModeStatusBanner
        bankMode={bankMode}
        experienceNoun="assessment"
        savedCustomQuestionCount={savedCustomQuestionCount}
      />

      <CustomOnlyEmptyBankNotice
        bankMode={bankMode}
        experienceNoun="assessment"
        savedCustomQuestionCount={savedCustomQuestionCount}
      />

      <QuestionBankModeControls
        bankMode={bankMode}
        savedCustomQuestionCount={savedCustomQuestionCount}
        pending={pending}
        modeReadOnly={modeReadOnly}
        modeManagedByFirm={modeManagedByFirm}
        experienceNoun="assessment"
        cardTitle="What clients see during assessments"
        highlightBankMode={highlightBankMode}
        bankModeCardRef={bankModeCardRef}
        cardId="assessment-bank-mode-card"
        onModeChange={async (value) => {
          return await new Promise<{ success: boolean }>((resolve) => {
            runPending(async () => {
              const result = await actions.updateBankMode(value);
              if (!result.success) {
                toast.error(result.error ?? "Something went wrong");
                resolve({ success: false });
                return;
              }
              toast.success(
                result.coercedToPlatform
                  ? customOnlyEmptyBankMessage("assessment")
                  : questionBankModeChangeMessage(value),
              );
              refreshAfterSuccess();
              resolve({ success: true });
            });
          });
        }}
      />

      <p className="text-sm text-muted-foreground">
        {questionBankModeDescription(bankMode, {
          platform: platformDescription,
          combined: combinedDescription,
          custom: customDescription,
        })}
      </p>

      {activeQuestions.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {isCustomOnlyMode
            ? "No custom assessment questions for this risk domain yet. Add your first question below."
            : isPlatformOnlyMode
              ? "No platform assessment questions for this risk domain yet. Check back after defaults sync."
              : "No assessment questions yet for this bank mode."}
        </p>
      ) : (
        <div className="space-y-4">
          {activeQuestions.map((q) => (
            <QuestionCard
              key={q.id}
              q={q}
              pending={pending}
              actions={actions}
              runPending={runPending}
              handleMutationResult={handleMutationResult}
              refreshAfterSuccess={refreshAfterSuccess}
              canDelete={canDeleteCustom && isCustomIntakeQuestionSource(q.sourceKind)}
            />
          ))}
        </div>
      )}

      {canAddCustomQuestions ? (
        <CreateQuestionCard
          pillarSlug={pillarSlug}
          pending={pending}
          createFormKey={createFormKey}
          isPlatformOnlyMode={isPlatformOnlyMode}
          savedCustomQuestionCount={savedCustomQuestionCount}
          firmScope={firmScope}
          createDescription={createDescription}
          actions={actions}
          runPending={runPending}
          onCreateSuccess={handleCreateSuccess}
        />
      ) : null}
    </div>
  );
}

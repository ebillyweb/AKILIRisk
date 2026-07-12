"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import type { AdvisorQuestionSource, IntakeQuestionBankMode } from "@prisma/client";
import { ArrowDown, ArrowUp } from "lucide-react";
import {
  createAdvisorIntakeQuestion,
  deleteAdvisorIntakeQuestion,
  moveAdvisorIntakeQuestionOrder,
  updateAdvisorIntakeQuestion,
  updateAdvisorIntakeQuestionBankMode,
} from "@/lib/actions/methodology-actions";
import { isEnterpriseAdvisorQuestion } from "@/lib/methodology/advisor-question-policy";
import {
  customOnlyEmptyBankMessage,
  filterAndOrderQuestionsByBankMode,
  isCustomIntakeQuestionSource,
} from "@/lib/methodology/intake-question-bank-mode";
import { labelForAdvisorIntakeAnswerType } from "@/lib/methodology/advisor-intake-question-config";
import {
  readAdvisorIntakeQuestionForm,
  validateAdvisorIntakeQuestionFormClient,
  type AdvisorIntakeQuestionFormPayload,
} from "@/lib/methodology/advisor-intake-question-config";
import { IntakeQuestionAnswerFields } from "@/components/advisor/methodology/IntakeQuestionAnswerFields";
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
  options?: unknown;
};

type IntakeQuestionActions = {
  updateQuestion: typeof updateAdvisorIntakeQuestion;
  createQuestion: typeof createAdvisorIntakeQuestion;
  deleteQuestion: typeof deleteAdvisorIntakeQuestion;
  updateBankMode: typeof updateAdvisorIntakeQuestionBankMode;
  moveQuestion: typeof moveAdvisorIntakeQuestionOrder;
};

const defaultActions: IntakeQuestionActions = {
  updateQuestion: updateAdvisorIntakeQuestion,
  createQuestion: createAdvisorIntakeQuestion,
  deleteQuestion: deleteAdvisorIntakeQuestion,
  updateBankMode: updateAdvisorIntakeQuestionBankMode,
  moveQuestion: moveAdvisorIntakeQuestionOrder,
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
  canReorder,
  canMoveUp,
  canMoveDown,
}: {
  q: IntakeQuestionRow;
  index: number;
  pending: boolean;
  actions: IntakeQuestionActions;
  runPending: (fn: () => Promise<void>) => void;
  handleMutationResult: MutationHandlers["handleMutationResult"];
  refreshAfterSuccess: MutationHandlers["refreshAfterSuccess"];
  canDelete: boolean;
  canReorder: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
}) {
  const isCustom = isCustomIntakeQuestionSource(q.sourceKind);

  const move = (direction: "up" | "down") => {
    runPending(async () => {
      const result = await actions.moveQuestion(q.id, direction);
      if (!result.success) {
        toast.error(result.error ?? "Failed to reorder question");
        return;
      }
      refreshAfterSuccess();
    });
  };

  return (
    <Card key={q.id} className={!q.isVisible ? "opacity-70" : undefined}>
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div className="space-y-1">
          <CardTitle className="text-base">Question {index + 1}</CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={isCustom ? "secondary" : "outline"}>
              {sourceBadgeLabel(q.sourceKind)}
            </Badge>
            <Badge variant="outline">{labelForAdvisorIntakeAnswerType(q.answerType)}</Badge>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {canReorder ? (
            <>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8"
                disabled={pending || !canMoveUp}
                aria-label="Move question up"
                onClick={() => move("up")}
              >
                <ArrowUp className="size-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8"
                disabled={pending || !canMoveDown}
                aria-label="Move question down"
                onClick={() => move("down")}
              >
                <ArrowDown className="size-4" />
              </Button>
            </>
          ) : null}
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
                    toast.success(customOnlyEmptyBankMessage("intake"));
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
        </div>
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
          onSubmit={(event) => {
            event.preventDefault();
            const formData = new FormData(event.currentTarget);
            const validationError = validateAdvisorIntakeQuestionFormClient(formData);
            if (validationError) {
              toast.error(validationError);
              return;
            }
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
            <IntakeQuestionAnswerFields
              defaultAnswerType={q.answerType}
              defaultAnswer0={q.answer0}
              defaultAnswer1={q.answer1}
              defaultAnswer2={q.answer2}
              defaultAnswer3={q.answer3}
              defaultOptions={q.options}
            />
          ) : (
            <IntakeQuestionAnswerFields
              readOnly
              defaultAnswerType={q.answerType}
              defaultOptions={q.options}
            />
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
  isPlatformOnlyMode,
  savedCustomQuestionCount,
  firmScope,
  createDescription,
  actions,
  runPending,
  onCreateSuccess,
}: {
  pending: boolean;
  createFormKey: number;
  isPlatformOnlyMode: boolean;
  savedCustomQuestionCount: number;
  firmScope: boolean;
  createDescription: string;
  actions: IntakeQuestionActions;
  runPending: (fn: () => Promise<void>) => void;
  onCreateSuccess: (result: { switchedToCombinedBank?: boolean }, resetForm: () => void) => void;
}) {
  const [switchDialogOpen, setSwitchDialogOpen] = useState(false);
  const [pendingPayload, setPendingPayload] = useState<AdvisorIntakeQuestionFormPayload | null>(
    null,
  );

  const submitCreate = (payload: AdvisorIntakeQuestionFormPayload, switchToCombinedBank: boolean) => {
    runPending(async () => {
      const result = await actions.createQuestion({
        questionText: payload.questionText,
        context: payload.context,
        answerType: payload.answerType,
        answer0: payload.answer0,
        answer1: payload.answer1,
        answer2: payload.answer2,
        answer3: payload.answer3,
        options: payload.options,
        switchToCombinedBank,
      });
      if (!result.success) {
        toast.error(result.error ?? "Something went wrong");
        return;
      }
      setSwitchDialogOpen(false);
      setPendingPayload(null);
      onCreateSuccess(
        { switchedToCombinedBank: result.switchedToCombinedBank },
        () => setSwitchDialogOpen(false),
      );
    });
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {isPlatformOnlyMode ? "Add custom intake questions" : "Add custom intake question"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-3 text-sm text-muted-foreground">
            {isPlatformOnlyMode
              ? "Add custom questions after your platform intake set. Platform questions stay first."
              : createDescription}
          </p>
          <form
            key={createFormKey}
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              const formData = new FormData(event.currentTarget);
              const validationError = validateAdvisorIntakeQuestionFormClient(formData);
              if (validationError) {
                toast.error(validationError);
                return;
              }
              const payload = readAdvisorIntakeQuestionForm(formData);
              if (!isPlatformOnlyMode) {
                submitCreate(payload, false);
                return;
              }
              setPendingPayload(payload);
              setSwitchDialogOpen(true);
            }}
          >
            <div className="space-y-2">
              <LabelWithHelp helpKey="advisor-intake-question-text">Question text</LabelWithHelp>
              <Textarea name="questionText" placeholder="Question text" rows={3} required />
            </div>
            <div className="space-y-2">
              <LabelWithHelp helpKey="advisor-intake-context">
                Context / coaching prompt (optional)
              </LabelWithHelp>
              <Textarea name="context" placeholder="Context / coaching prompt (optional)" rows={2} />
            </div>
            <IntakeQuestionAnswerFields idPrefix="create-" />
            <Button type="submit" size="sm" disabled={pending}>
              {isPlatformOnlyMode ? "Add custom question…" : "Add question"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <SwitchToCombinedQuestionBankDialog
        bankKind="intake"
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

export function IntakeScriptEditor({
  questions,
  bankMode,
  savedCustomQuestionCount: savedCustomQuestionCountProp,
  modeReadOnly = false,
  modeManagedByFirm = false,
  firmScope = false,
  actions = defaultActions,
  createDescription = "Custom questions apply to new intakes only. Switch bank mode anytime — your custom set is saved.",
  platformDescription = "Use AkiliRisk platform intake questions. Edit or hide individual prompts — they cannot be deleted.",
  combinedDescription = "Platform intake questions appear first, followed by your custom prompts.",
  customDescription = "Build your own intake question set. Platform questions are not included while custom-only mode is active.",
}: {
  questions: IntakeQuestionRow[];
  bankMode: IntakeQuestionBankMode;
  savedCustomQuestionCount?: number;
  modeReadOnly?: boolean;
  modeManagedByFirm?: boolean;
  firmScope?: boolean;
  actions?: IntakeQuestionActions;
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
  // Reorderable rows are the scope's OWN custom prompts (sourceKind CUSTOM),
  // in their displayed order. Platform base and firm-default (ENTERPRISE) rows
  // are ordered elsewhere and not reorderable here (Scope A: custom block only).
  const reorderableIds = activeQuestions
    .filter((q) => q.sourceKind === "CUSTOM")
    .map((q) => q.id);
  const isPlatformOnlyMode = bankMode === "PLATFORM";
  const isCustomOnlyMode = bankMode === "CUSTOM";
  const savedCustomQuestionCount =
    savedCustomQuestionCountProp ??
    questions.filter((q) => isCustomIntakeQuestionSource(q.sourceKind)).length;
  const canAddCustomQuestions = !modeReadOnly;
  const canDeleteCustom = canDeleteCustomQuestionInBankMode(bankMode);

  const runPending = (fn: () => Promise<void>) => {
    startTransition(async () => {
      await fn();
    });
  };

  const handleCreateSuccess = (
    result: { switchedToCombinedBank?: boolean },
    _resetDialog: () => void,
  ) => {
    if (result.switchedToCombinedBank) {
      toast.success(
        firmScope
          ? "Custom intake questions will now follow the firm platform set for new clients."
          : "Custom intake questions will now follow your platform set for new clients.",
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
    <div className="space-y-4" data-tour="intake-questions">
      <QuestionBankModeStatusBanner
        bankMode={bankMode}
        experienceNoun="intake"
        savedCustomQuestionCount={savedCustomQuestionCount}
      />

      <CustomOnlyEmptyBankNotice
        bankMode={bankMode}
        experienceNoun="intake"
        savedCustomQuestionCount={savedCustomQuestionCount}
      />

      <QuestionBankModeControls
        bankMode={bankMode}
        savedCustomQuestionCount={savedCustomQuestionCount}
        pending={pending}
        modeReadOnly={modeReadOnly}
        modeManagedByFirm={modeManagedByFirm}
        experienceNoun="intake"
        cardTitle="What clients see during intake"
        highlightBankMode={highlightBankMode}
        bankModeCardRef={bankModeCardRef}
        cardId="intake-bank-mode-card"
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
                  ? customOnlyEmptyBankMessage("intake")
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
            ? "No custom intake questions yet. Add your first question below."
            : isPlatformOnlyMode
              ? "No platform intake questions yet. Check back after defaults sync."
              : "No intake questions yet for this bank mode."}
        </p>
      ) : (
        <div className="space-y-4">
          {activeQuestions.map((q, index) => {
            // Only the scope's own custom rows reorder, within the custom block.
            const reorderPos = reorderableIds.indexOf(q.id);
            const canReorder = reorderPos >= 0 && reorderableIds.length > 1;
            return (
              <QuestionCard
                key={q.id}
                q={q}
                index={index}
                pending={pending}
                actions={actions}
                runPending={runPending}
                handleMutationResult={handleMutationResult}
                refreshAfterSuccess={refreshAfterSuccess}
                canDelete={canDeleteCustom && isCustomIntakeQuestionSource(q.sourceKind)}
                canReorder={canReorder}
                canMoveUp={canReorder && reorderPos > 0}
                canMoveDown={canReorder && reorderPos < reorderableIds.length - 1}
              />
            );
          })}
        </div>
      )}

      {canAddCustomQuestions ? (
        <CreateQuestionCard
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

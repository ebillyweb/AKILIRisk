"use client";

import type { IntakeQuestionBankMode } from "@prisma/client";
import {
  bankModeSwitchSuccessMessage,
  customOnlyEmptyBankMessage,
  effectiveQuestionBankMode,
  isCustomOnlyWithoutSavedQuestions,
} from "@/lib/methodology/intake-question-bank-mode";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";

type QuestionBankModeControlsProps = {
  bankMode: IntakeQuestionBankMode;
  savedCustomQuestionCount: number;
  pending: boolean;
  modeReadOnly: boolean;
  modeManagedByFirm: boolean;
  experienceNoun: "intake" | "assessment";
  cardTitle: string;
  highlightBankMode: boolean;
  bankModeCardRef: React.RefObject<HTMLDivElement | null>;
  cardId: string;
  onModeChange: (mode: IntakeQuestionBankMode) => void;
};

const MODE_VALUES: IntakeQuestionBankMode[] = ["PLATFORM", "COMBINED", "CUSTOM"];

function isBankMode(value: string): value is IntakeQuestionBankMode {
  return MODE_VALUES.includes(value as IntakeQuestionBankMode);
}

export function QuestionBankModeStatusBanner({
  bankMode,
  experienceNoun,
  savedCustomQuestionCount,
}: {
  bankMode: IntakeQuestionBankMode;
  experienceNoun: "intake" | "assessment";
  savedCustomQuestionCount: number;
}) {
  const effectiveMode = effectiveQuestionBankMode(bankMode, savedCustomQuestionCount);
  const isCustomOnly = effectiveMode === "CUSTOM";
  const isCombined = effectiveMode === "COMBINED";

  return (
    <div
      className={cn(
        "rounded-lg border px-4 py-3 text-sm",
        isCustomOnly || isCombined ? "border-primary/30 bg-primary/5" : "border-border bg-muted/30",
      )}
    >
      {isCustomOnly ? (
        <p>
          Clients see <strong>your custom</strong> {experienceNoun} questions only. Platform
          questions are off for new {experienceNoun === "intake" ? "intakes" : "assessments"}.
        </p>
      ) : isCombined ? (
        <p>
          Clients see <strong>platform questions first</strong>, then your custom {experienceNoun}{" "}
          questions.
        </p>
      ) : (
        <p>
          Clients see <strong>AkiliRisk platform</strong> {experienceNoun} questions only.
        </p>
      )}
    </div>
  );
}

export function CustomOnlyEmptyBankNotice({
  bankMode,
  experienceNoun,
  savedCustomQuestionCount,
}: {
  bankMode: IntakeQuestionBankMode;
  experienceNoun: "intake" | "assessment";
  savedCustomQuestionCount: number;
}) {
  if (!isCustomOnlyWithoutSavedQuestions(bankMode, savedCustomQuestionCount)) {
    return null;
  }

  return (
    <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-950 dark:text-amber-100">
      {customOnlyEmptyBankMessage(experienceNoun)}
    </div>
  );
}

export function QuestionBankModeControls({
  bankMode,
  savedCustomQuestionCount,
  pending,
  modeReadOnly,
  modeManagedByFirm,
  experienceNoun,
  cardTitle,
  highlightBankMode,
  bankModeCardRef,
  cardId,
  onModeChange,
}: QuestionBankModeControlsProps) {
  const displayedMode = effectiveQuestionBankMode(bankMode, savedCustomQuestionCount);

  return (
    <div
      ref={bankModeCardRef}
      id={cardId}
      data-tour="question-bank-mode"
      className={cn(
        "rounded-xl transition-shadow",
        highlightBankMode && "ring-2 ring-primary ring-offset-2",
      )}
    >
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{cardTitle}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Choose how client {experienceNoun} questions are assembled. New practices default to
            platform only; combined adds custom prompts after the catalog.
          </p>
          {modeManagedByFirm ? (
            <p className="text-sm text-muted-foreground">
              This setting is managed in firm Practice Standards.
            </p>
          ) : null}
          <RadioGroup
            value={displayedMode}
            disabled={pending || modeReadOnly}
            onValueChange={(value) => {
              if (!isBankMode(value)) return;
              onModeChange(value);
            }}
            className="grid gap-3 lg:grid-cols-3"
          >
            <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border p-4 has-[:checked]:border-primary has-[:checked]:bg-primary/5">
              <RadioGroupItem value="PLATFORM" className="mt-0.5" />
              <div className="space-y-1">
                <p className="text-sm font-medium">Platform only</p>
                <p className="text-sm text-muted-foreground">
                  AkiliRisk catalog questions for your clients.
                </p>
              </div>
            </label>
            <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border p-4 has-[:checked]:border-primary has-[:checked]:bg-primary/5">
              <RadioGroupItem value="COMBINED" className="mt-0.5" />
              <div className="space-y-1">
                <p className="text-sm font-medium">Combined</p>
                <p className="text-sm text-muted-foreground">
                  Platform questions first, then your custom prompts.
                </p>
              </div>
            </label>
            <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border p-4 has-[:checked]:border-primary has-[:checked]:bg-primary/5">
              <RadioGroupItem value="CUSTOM" className="mt-0.5" />
              <div className="space-y-1">
                <p className="text-sm font-medium">Custom only</p>
                <p className="text-sm text-muted-foreground">
                  Your own {experienceNoun} prompts only.
                </p>
              </div>
            </label>
          </RadioGroup>
        </CardContent>
      </Card>
    </div>
  );
}

export function questionBankModeChangeMessage(mode: IntakeQuestionBankMode): string {
  return bankModeSwitchSuccessMessage(mode);
}

export function questionBankModeDescription(
  bankMode: IntakeQuestionBankMode,
  descriptions: {
    platform: string;
    combined: string;
    custom: string;
  },
): string {
  if (bankMode === "CUSTOM") return descriptions.custom;
  if (bankMode === "COMBINED") return descriptions.combined;
  return descriptions.platform;
}

export function canDeleteCustomQuestionInBankMode(bankMode: IntakeQuestionBankMode): boolean {
  return bankMode === "CUSTOM" || bankMode === "COMBINED";
}

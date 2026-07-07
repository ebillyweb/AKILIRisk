"use client";

import { useMemo, useState } from "react";
import { Minus, Plus } from "lucide-react";

import {
  ADVISOR_INTAKE_ANSWER_TYPE_OPTIONS,
  type AdvisorIntakeAnswerType,
} from "@/lib/methodology/advisor-intake-question-config";
import { getAnswerOptionFields } from "@/lib/assessment/bank/question-bank-display";
import {
  INTAKE_CHOICE_LIST_MAX,
  INTAKE_CHOICE_LIST_MIN,
  parseStoredIntakeChoiceListOptions,
} from "@/lib/intake/choice-list-options";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FieldHelp, LabelWithHelp } from "@/components/ui/field-help";

type IntakeQuestionAnswerFieldsProps = {
  defaultAnswerType?: string;
  defaultAnswer0?: string | null;
  defaultAnswer1?: string | null;
  defaultAnswer2?: string | null;
  defaultAnswer3?: string | null;
  defaultOptions?: unknown;
  readOnly?: boolean;
  idPrefix?: string;
};

function initialChoiceLabels(defaultOptions: unknown): string[] {
  const parsed = parseStoredIntakeChoiceListOptions(defaultOptions);
  if (parsed.length >= INTAKE_CHOICE_LIST_MIN) {
    return parsed.map((option) => option.label);
  }
  return ["", "", ""];
}

function choiceListValidationError(labels: string[]): string | null {
  const filled = labels.map((label) => label.trim()).filter(Boolean);
  if (filled.length < INTAKE_CHOICE_LIST_MIN) {
    return `Provide at least ${INTAKE_CHOICE_LIST_MIN} non-empty options`;
  }
  if (filled.length > INTAKE_CHOICE_LIST_MAX) {
    return `At most ${INTAKE_CHOICE_LIST_MAX} options are allowed`;
  }
  return null;
}

export function IntakeQuestionAnswerFields({
  defaultAnswerType = "fillable",
  defaultAnswer0 = "",
  defaultAnswer1 = "",
  defaultAnswer2 = "",
  defaultAnswer3 = "",
  defaultOptions = null,
  readOnly = false,
  idPrefix = "",
}: IntakeQuestionAnswerFieldsProps) {
  const initialType = ADVISOR_INTAKE_ANSWER_TYPE_OPTIONS.some(
    (option) => option.value === defaultAnswerType,
  )
    ? (defaultAnswerType as AdvisorIntakeAnswerType)
    : "fillable";
  const [answerType, setAnswerType] = useState<AdvisorIntakeAnswerType>(initialType);
  const [choiceLabels, setChoiceLabels] = useState<string[]>(() =>
    initialChoiceLabels(defaultOptions),
  );
  const [choiceListTouched, setChoiceListTouched] = useState(false);

  const answerOptions = useMemo(
    () =>
      getAnswerOptionFields(answerType, {
        answer0: defaultAnswer0 ?? "",
        answer1: defaultAnswer1 ?? "",
        answer2: defaultAnswer2 ?? "",
        answer3: defaultAnswer3 ?? "",
      }),
    [answerType, defaultAnswer0, defaultAnswer1, defaultAnswer2, defaultAnswer3],
  );

  const choiceListError =
    answerType === "choice_list" && choiceListTouched
      ? choiceListValidationError(choiceLabels)
      : null;

  if (readOnly) {
    const label =
      ADVISOR_INTAKE_ANSWER_TYPE_OPTIONS.find((option) => option.value === initialType)?.label ??
      initialType;
    const choicePreview =
      initialType === "choice_list"
        ? parseStoredIntakeChoiceListOptions(defaultOptions)
        : [];

    return (
      <div className="space-y-2">
        <Label>How clients answer</Label>
        <p className="text-sm text-muted-foreground">{label}</p>
        {choicePreview.length > 0 ? (
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            {choicePreview.map((option) => (
              <li key={option.value}>{option.label}</li>
            ))}
          </ul>
        ) : null}
      </div>
    );
  }

  const showChoiceListEditor = answerType === "choice_list";

  return (
    <>
      <div className="space-y-2">
        <LabelWithHelp htmlFor={`${idPrefix}answerType`} helpKey="advisor-assessment-answer-type">
          How clients answer
        </LabelWithHelp>
        <input type="hidden" name="answerType" value={answerType} />
        <Select
          value={answerType}
          onValueChange={(value) => {
            const next = value as AdvisorIntakeAnswerType;
            setAnswerType(next);
            setChoiceListTouched(false);
            if (next === "choice_list" && choiceLabels.length < INTAKE_CHOICE_LIST_MIN) {
              setChoiceLabels(["", "", ""]);
            }
          }}
        >
          <SelectTrigger id={`${idPrefix}answerType`} aria-label="How clients answer">
            <SelectValue placeholder="Choose answer type" />
          </SelectTrigger>
          <SelectContent>
            {ADVISOR_INTAKE_ANSWER_TYPE_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {showChoiceListEditor ? (
        <div className="space-y-3 rounded-lg border border-border/60 bg-muted/15 p-4">
          <div className="space-y-1">
            <Label>Answer options</Label>
            <p className="text-xs text-muted-foreground">
              Clients pick one option. Add between {INTAKE_CHOICE_LIST_MIN} and{" "}
              {INTAKE_CHOICE_LIST_MAX} choices.
            </p>
          </div>
          <div className="space-y-2">
            {choiceLabels.map((label, index) => (
              <div key={`${idPrefix}choice-${index}`} className="flex items-center gap-2">
                <Input
                  name="optionLabel"
                  value={label}
                  placeholder={`Option ${index + 1}`}
                  aria-invalid={Boolean(choiceListError)}
                  onChange={(event) => {
                    setChoiceListTouched(true);
                    const next = [...choiceLabels];
                    next[index] = event.target.value;
                    setChoiceLabels(next);
                  }}
                  onBlur={() => setChoiceListTouched(true)}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="shrink-0"
                  disabled={choiceLabels.length <= INTAKE_CHOICE_LIST_MIN}
                  aria-label={`Remove option ${index + 1}`}
                  onClick={() => {
                    setChoiceListTouched(true);
                    setChoiceLabels((current) =>
                      current.length <= INTAKE_CHOICE_LIST_MIN
                        ? current
                        : current.filter((_, itemIndex) => itemIndex !== index),
                    );
                  }}
                >
                  <Minus className="size-4" aria-hidden />
                </Button>
              </div>
            ))}
          </div>
          {choiceListError ? (
            <p className="text-sm text-destructive" role="alert">
              {choiceListError}
            </p>
          ) : null}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-2"
            disabled={choiceLabels.length >= INTAKE_CHOICE_LIST_MAX}
            onClick={() => setChoiceLabels((current) => [...current, ""])}
          >
            <Plus className="size-4" aria-hidden />
            Add option
          </Button>
        </div>
      ) : answerOptions.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {answerOptions.map((field) => (
            <div key={field.name} className="space-y-2">
              <div className="flex items-center gap-1.5">
                <Label htmlFor={`${idPrefix}${field.name}`}>{field.label}</Label>
                <FieldHelp helpKey="advisor-assessment-answer-option" triggerLabel={field.label} />
              </div>
              <Input
                id={`${idPrefix}${field.name}`}
                name={field.name}
                defaultValue={field.defaultValue}
                placeholder={field.label}
              />
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          Clients enter a free-form response. No preset answer labels are needed for this type.
        </p>
      )}
    </>
  );
}

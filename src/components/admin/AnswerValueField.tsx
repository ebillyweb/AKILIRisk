"use client";

import type { RecommendationCondition } from "@/lib/admin/recommendation-rule-schemas";
import {
  ANSWER_OPERATOR_OPTIONS,
  answerMatchListFromValue,
  type RulePickerAnswerOption,
  type RulePickerQuestion,
} from "@/lib/admin/recommendation-rule-ui";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type AnswerMatchCondition = RecommendationCondition & { type: "answer_match" };

type AnswerValueFieldProps = {
  index: number;
  condition: AnswerMatchCondition;
  question?: RulePickerQuestion;
  disabled?: boolean;
  onChange: (next: AnswerMatchCondition) => void;
};

function parseStoredAnswerValue(raw: string): string | number | boolean {
  if (raw === "true") return true;
  if (raw === "false") return false;
  const numeric = Number(raw);
  if (raw !== "" && Number.isFinite(numeric) && String(numeric) === raw) {
    return numeric;
  }
  return raw;
}

function selectedValuesForInOperator(condition: AnswerMatchCondition): string[] {
  if (!Array.isArray(condition.value)) return [];
  return condition.value.map(String);
}

export function AnswerValueField({
  index,
  condition,
  question,
  disabled = false,
  onChange,
}: AnswerValueFieldProps) {
  const options = question?.answerOptions ?? [];
  const hasOptions = options.length > 0;

  return (
    <>
      <div className="space-y-2">
        <Label htmlFor={`answer-op-${index}`}>Comparison</Label>
        <Select
          value={condition.operator}
          onValueChange={(operator) =>
            onChange({
              ...condition,
              operator: operator as AnswerMatchCondition["operator"],
            })
          }
          disabled={disabled}
        >
          <SelectTrigger id={`answer-op-${index}`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ANSWER_OPERATOR_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <AnswerValueInput
        index={index}
        condition={condition}
        question={question}
        options={options}
        hasOptions={hasOptions}
        disabled={disabled}
        onChange={onChange}
      />
    </>
  );
}

function AnswerValueInput({
  index,
  condition,
  question,
  options,
  hasOptions,
  disabled,
  onChange,
}: {
  index: number;
  condition: AnswerMatchCondition;
  question?: RulePickerQuestion;
  options: RulePickerAnswerOption[];
  hasOptions: boolean;
  disabled: boolean;
  onChange: (next: AnswerMatchCondition) => void;
}) {
  if (hasOptions && condition.operator === "equals") {
    return (
      <div className="space-y-2">
        <Label htmlFor={`answer-value-${index}`}>Expected answer</Label>
        <Select
          value={String(condition.value ?? "")}
          onValueChange={(raw) =>
            onChange({
              ...condition,
              value: parseStoredAnswerValue(raw),
            })
          }
          disabled={disabled}
        >
          <SelectTrigger id={`answer-value-${index}`}>
            <SelectValue placeholder="Choose an answer" />
          </SelectTrigger>
          <SelectContent>
            {options.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }

  if (hasOptions && condition.operator === "in") {
    const selected = new Set(selectedValuesForInOperator(condition));
    return (
      <div className="space-y-2 md:col-span-2">
        <Label>Accepted answers</Label>
        <div className="flex flex-wrap gap-4">
          {options.map((option) => (
            <label key={option.value} className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={selected.has(option.value)}
                disabled={disabled}
                onCheckedChange={(checked) => {
                  const next = new Set(selected);
                  if (checked) next.add(option.value);
                  else next.delete(option.value);
                  onChange({
                    ...condition,
                    value: [...next].map(parseStoredAnswerValue),
                  });
                }}
              />
              {option.label}
            </label>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Label htmlFor={`answer-value-${index}`}>
        {condition.operator === "in" ? "Accepted answers" : "Expected answer"}
      </Label>
      <Input
        id={`answer-value-${index}`}
        value={answerMatchListFromValue(condition)}
        disabled={disabled}
        placeholder={condition.operator === "in" ? "0, 1, 2" : "yes"}
        onChange={(event) => {
          const raw = event.target.value;
          if (condition.operator === "in") {
            const parts = raw
              .split(",")
              .map((part) => part.trim())
              .filter(Boolean)
              .map(parseStoredAnswerValue);
            onChange({ ...condition, value: parts.length > 0 ? parts : [""] });
            return;
          }
          onChange({
            ...condition,
            value: parseStoredAnswerValue(raw),
          });
        }}
      />
      {condition.operator === "in" ? (
        <p className="text-xs text-muted-foreground">
          Separate multiple values with commas.
        </p>
      ) : null}
      {!hasOptions && question ? (
        <p className="text-xs text-muted-foreground">
          This question uses free-form answers, so enter the expected value manually.
        </p>
      ) : null}
    </div>
  );
}

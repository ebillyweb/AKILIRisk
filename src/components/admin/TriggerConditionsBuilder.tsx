"use client";

import { Plus, Trash2 } from "lucide-react";
import type { RecommendationCondition } from "@/lib/admin/recommendation-rule-schemas";
import {
  CONDITION_TYPE_OPTIONS,
  PILLAR_OPTIONS,
  PROFILE_OPERATOR_OPTIONS,
  RISK_LEVEL_OPERATOR_OPTIONS,
  RISK_LEVEL_OPTIONS,
  SCORE_OPERATOR_OPTIONS,
  defaultTriggerCondition,
  findRulePickerQuestion,
  riskLevelsFromValue,
  type RiskLevel,
  type RulePickerQuestion,
} from "@/lib/admin/recommendation-rule-ui";
import { AnswerValueField } from "@/components/admin/AnswerValueField";
import { QuestionPicker } from "@/components/admin/QuestionPicker";
import { Button } from "@/components/ui/button";
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

type TriggerConditionsBuilderProps = {
  value: RecommendationCondition[];
  onChange: (next: RecommendationCondition[]) => void;
  questions: RulePickerQuestion[];
  disabled?: boolean;
  error?: string | null;
};

function updateAt<T>(
  list: T[],
  index: number,
  updater: (item: T) => T,
): T[] {
  return list.map((item, i) => (i === index ? updater(item) : item));
}

function switchConditionType(
  current: RecommendationCondition,
  nextType: RecommendationCondition["type"],
): RecommendationCondition {
  switch (nextType) {
    case "score_threshold":
      return {
        type: "score_threshold",
        pillarId: PILLAR_OPTIONS[0]?.value ?? "cyber-digital",
        operator: "less_than",
        value: 1.8,
        weight: current.weight ?? 1,
      };
    case "risk_level":
      return {
        type: "risk_level",
        pillarId: PILLAR_OPTIONS[0]?.value ?? "cyber-digital",
        operator: "in",
        value: ["high", "critical"],
        weight: current.weight ?? 1,
      };
    case "answer_match":
      return {
        type: "answer_match",
        questionId: "",
        operator: "equals",
        value: "",
        weight: current.weight ?? 1,
      };
    case "missing_control":
      return {
        type: "missing_control",
        questionId: "",
        operator: "equals",
        weight: current.weight ?? 1,
      };
    case "profile_condition":
      return {
        type: "profile_condition",
        field: "",
        operator: "equals",
        value: "",
        weight: current.weight ?? 1,
      };
    default:
      return defaultTriggerCondition();
  }
}

export function TriggerConditionsBuilder({
  value,
  onChange,
  questions,
  disabled = false,
  error,
}: TriggerConditionsBuilderProps) {
  return (
    <div className="space-y-4">
      <div>
        <Label>When should this rule fire?</Label>
        <p className="mt-1 text-xs text-muted-foreground">
          Add one or more checks below. The rule matches when more than half of the total
          importance weight is satisfied.
        </p>
      </div>

      <div className="space-y-3">
        {value.map((condition, index) => (
          <ConditionCard
            key={index}
            index={index}
            condition={condition}
            questions={questions}
            disabled={disabled}
            canRemove={value.length > 1}
            onChange={(next) => onChange(updateAt(value, index, () => next))}
            onRemove={() => onChange(value.filter((_, i) => i !== index))}
          />
        ))}
      </div>

      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled}
        onClick={() => onChange([...value, defaultTriggerCondition()])}
      >
        <Plus className="mr-2 h-4 w-4" />
        Add another check
      </Button>

      {error ? (
        <pre className="whitespace-pre-wrap text-xs text-destructive">{error}</pre>
      ) : null}
    </div>
  );
}

function ConditionCard({
  index,
  condition,
  questions,
  disabled,
  canRemove,
  onChange,
  onRemove,
}: {
  index: number;
  condition: RecommendationCondition;
  questions: RulePickerQuestion[];
  disabled: boolean;
  canRemove: boolean;
  onChange: (next: RecommendationCondition) => void;
  onRemove: () => void;
}) {
  const typeMeta = CONDITION_TYPE_OPTIONS.find((o) => o.value === condition.type);
  const selectedQuestion =
    condition.type === "answer_match" || condition.type === "missing_control"
      ? findRulePickerQuestion(questions, condition.questionId)
      : undefined;

  return (
    <div className="rounded-lg border bg-card p-4 shadow-sm">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium">Check {index + 1}</p>
          {typeMeta ? (
            <p className="mt-0.5 text-xs text-muted-foreground">{typeMeta.description}</p>
          ) : null}
        </div>
        {canRemove ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={disabled}
            onClick={onRemove}
            aria-label={`Remove check ${index + 1}`}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        ) : null}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor={`condition-type-${index}`}>Check type</Label>
          <Select
            value={condition.type}
            onValueChange={(next) =>
              onChange(switchConditionType(condition, next as RecommendationCondition["type"]))
            }
            disabled={disabled}
          >
            <SelectTrigger id={`condition-type-${index}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CONDITION_TYPE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {condition.type === "score_threshold" ? (
          <>
            <PillarSelect
              id={`pillar-${index}`}
              value={condition.pillarId}
              disabled={disabled}
              onChange={(pillarId) => onChange({ ...condition, pillarId })}
            />
            <div className="space-y-2">
              <Label htmlFor={`score-op-${index}`}>Comparison</Label>
              <Select
                value={condition.operator}
                onValueChange={(operator) =>
                  onChange({
                    ...condition,
                    operator: operator as typeof condition.operator,
                  })
                }
                disabled={disabled}
              >
                <SelectTrigger id={`score-op-${index}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SCORE_OPERATOR_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor={`score-value-${index}`}>Score value</Label>
              <Input
                id={`score-value-${index}`}
                type="number"
                step="0.1"
                value={Number.isFinite(condition.value) ? condition.value : ""}
                disabled={disabled}
                onChange={(e) =>
                  onChange({ ...condition, value: Number(e.target.value) })
                }
              />
            </div>
          </>
        ) : null}

        {condition.type === "risk_level" ? (
          <>
            <PillarSelect
              id={`risk-pillar-${index}`}
              value={condition.pillarId}
              disabled={disabled}
              onChange={(pillarId) => onChange({ ...condition, pillarId })}
            />
            <div className="space-y-2">
              <Label htmlFor={`risk-op-${index}`}>Comparison</Label>
              <Select
                value={condition.operator}
                onValueChange={(operator) => {
                  const nextOperator = operator as typeof condition.operator;
                  onChange({
                    ...condition,
                    operator: nextOperator,
                    value:
                      nextOperator === "in"
                        ? riskLevelsFromValue(condition)
                        : riskLevelsFromValue(condition)[0] ?? "high",
                  });
                }}
                disabled={disabled}
              >
                <SelectTrigger id={`risk-op-${index}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RISK_LEVEL_OPERATOR_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Risk level{condition.operator === "in" ? "s" : ""}</Label>
              {condition.operator === "in" ? (
                <div className="flex flex-wrap gap-4">
                  {RISK_LEVEL_OPTIONS.map((level) => {
                    const selected = riskLevelsFromValue(condition).includes(level.value);
                    return (
                      <label key={level.value} className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={selected}
                          disabled={disabled}
                          onCheckedChange={(checked) => {
                            const current = new Set(riskLevelsFromValue(condition));
                            if (checked) current.add(level.value);
                            else current.delete(level.value);
                            onChange({
                              ...condition,
                              value: [...current] as RiskLevel[],
                            });
                          }}
                        />
                        {level.label}
                      </label>
                    );
                  })}
                </div>
              ) : (
                <Select
                  value={riskLevelsFromValue(condition)[0] ?? "high"}
                  onValueChange={(level) =>
                    onChange({
                      ...condition,
                      value: level as RiskLevel,
                    })
                  }
                  disabled={disabled}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {RISK_LEVEL_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </>
        ) : null}

        {condition.type === "answer_match" ? (
          <>
            <QuestionPicker
              id={`question-${index}`}
              label="Question"
              value={condition.questionId}
              questions={questions}
              disabled={disabled}
              onChange={(questionId) => onChange({ ...condition, questionId })}
              helperText="Pick the intake question this rule should inspect."
            />
            <AnswerValueField
              index={index}
              condition={condition}
              question={selectedQuestion}
              disabled={disabled}
              onChange={onChange}
            />
          </>
        ) : null}

        {condition.type === "missing_control" ? (
          <QuestionPicker
            id={`missing-${index}`}
            label="Question"
            value={condition.questionId}
            questions={questions}
            disabled={disabled}
            onChange={(questionId) => onChange({ ...condition, questionId })}
            helperText="Fires when this control is flagged as missing in the assessment."
          />
        ) : null}

        {condition.type === "profile_condition" ? (
          <>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor={`profile-field-${index}`}>Profile field</Label>
              <Input
                id={`profile-field-${index}`}
                value={condition.field}
                disabled={disabled}
                placeholder="e.g. householdSize"
                onChange={(e) => onChange({ ...condition, field: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`profile-op-${index}`}>Comparison</Label>
              <Select
                value={condition.operator}
                onValueChange={(operator) =>
                  onChange({
                    ...condition,
                    operator: operator as typeof condition.operator,
                  })
                }
                disabled={disabled}
              >
                <SelectTrigger id={`profile-op-${index}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROFILE_OPERATOR_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor={`profile-value-${index}`}>Value</Label>
              <Input
                id={`profile-value-${index}`}
                value={
                  Array.isArray(condition.value)
                    ? condition.value.join(", ")
                    : String(condition.value ?? "")
                }
                disabled={disabled}
                onChange={(e) => {
                  const raw = e.target.value;
                  if (condition.operator === "in") {
                    const parts = raw
                      .split(",")
                      .map((part) => part.trim())
                      .filter(Boolean);
                    onChange({ ...condition, value: parts });
                    return;
                  }
                  const numeric = Number(raw);
                  onChange({
                    ...condition,
                    value: raw !== "" && Number.isFinite(numeric) ? numeric : raw,
                  });
                }}
              />
            </div>
          </>
        ) : null}

        <div className="space-y-2">
          <Label htmlFor={`weight-${index}`}>Importance</Label>
          <Input
            id={`weight-${index}`}
            type="number"
            min={1}
            max={10}
            value={condition.weight ?? 1}
            disabled={disabled}
            onChange={(e) =>
              onChange({ ...condition, weight: Number(e.target.value) || 1 })
            }
          />
          <p className="text-xs text-muted-foreground">1 = optional, 10 = critical</p>
        </div>
      </div>
    </div>
  );
}

function PillarSelect({
  id,
  value,
  disabled,
  onChange,
}: {
  id: string;
  value: string;
  disabled: boolean;
  onChange: (pillarId: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>Pillar</Label>
      <Select value={value} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger id={id}>
          <SelectValue placeholder="Choose a pillar" />
        </SelectTrigger>
        <SelectContent>
          {PILLAR_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

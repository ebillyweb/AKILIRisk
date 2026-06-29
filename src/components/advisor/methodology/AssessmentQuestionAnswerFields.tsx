"use client";

import { useState } from "react";

import { getAnswerOptionFields } from "@/lib/assessment/bank/question-bank-display";
import {
  ADVISOR_ASSESSMENT_ANSWER_TYPE_OPTIONS,
  type AdvisorAssessmentAnswerType,
} from "@/lib/methodology/advisor-assessment-question-config";
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

type AssessmentQuestionAnswerFieldsProps = {
  defaultAnswerType?: string;
  defaultAnswer0?: string | null;
  defaultAnswer1?: string | null;
  defaultAnswer2?: string | null;
  defaultAnswer3?: string | null;
  readOnly?: boolean;
  idPrefix?: string;
};

export function AssessmentQuestionAnswerFields({
  defaultAnswerType = "scored_0_3",
  defaultAnswer0 = "",
  defaultAnswer1 = "",
  defaultAnswer2 = "",
  defaultAnswer3 = "",
  readOnly = false,
  idPrefix = "",
}: AssessmentQuestionAnswerFieldsProps) {
  const initialType = ADVISOR_ASSESSMENT_ANSWER_TYPE_OPTIONS.some(
    (option) => option.value === defaultAnswerType,
  )
    ? (defaultAnswerType as AdvisorAssessmentAnswerType)
    : "scored_0_3";
  const [answerType, setAnswerType] = useState<AdvisorAssessmentAnswerType>(initialType);

  const answerOptions = getAnswerOptionFields(answerType, {
    answer0: defaultAnswer0 ?? "",
    answer1: defaultAnswer1 ?? "",
    answer2: defaultAnswer2 ?? "",
    answer3: defaultAnswer3 ?? "",
  });

  if (readOnly) {
    const label =
      ADVISOR_ASSESSMENT_ANSWER_TYPE_OPTIONS.find((option) => option.value === initialType)
        ?.label ?? initialType;
    return (
      <div className="space-y-2">
        <Label>How clients answer</Label>
        <p className="text-sm text-muted-foreground">{label}</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-2">
        <LabelWithHelp htmlFor={`${idPrefix}answerType`} helpKey="advisor-assessment-answer-type">
          How clients answer
        </LabelWithHelp>
        <input type="hidden" name="answerType" value={answerType} />
        <Select
          value={answerType}
          onValueChange={(value) => setAnswerType(value as AdvisorAssessmentAnswerType)}
        >
          <SelectTrigger id={`${idPrefix}answerType`} aria-label="How clients answer">
            <SelectValue placeholder="Choose answer type" />
          </SelectTrigger>
          <SelectContent>
            {ADVISOR_ASSESSMENT_ANSWER_TYPE_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {answerOptions.length > 0 ? (
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

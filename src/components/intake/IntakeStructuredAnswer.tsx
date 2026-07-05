"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { IntakeQuestion } from "@/lib/intake/types";
import { intakeChoiceOptions, intakeUsesFreeformResponse } from "@/lib/intake/intake-answer-behavior";
import { cn } from "@/lib/utils";

type IntakeStructuredAnswerProps = {
  question: IntakeQuestion;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
};

export function IntakeStructuredAnswer({
  question,
  value,
  onChange,
  disabled = false,
}: IntakeStructuredAnswerProps) {
  const choices = intakeChoiceOptions(question);

  if (question.answerType === "number") {
    return (
      <div className="space-y-2">
        <Label htmlFor="intake-number-answer">Your answer</Label>
        <Input
          id="intake-number-answer"
          type="number"
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
        />
      </div>
    );
  }

  if (question.answerType === "date") {
    return (
      <div className="space-y-2">
        <Label htmlFor="intake-date-answer">Your answer</Label>
        <Input
          id="intake-date-answer"
          type="date"
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
        />
      </div>
    );
  }

  if (question.answerType === "date_mm_yyyy") {
    return (
      <div className="space-y-2">
        <Label htmlFor="intake-month-answer">Your answer</Label>
        <Input
          id="intake-month-answer"
          type="month"
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
        />
      </div>
    );
  }

  if (choices.length > 0) {
    return (
      <div className="space-y-3">
        <Label>Your answer</Label>
        <div className="flex flex-wrap gap-2">
          {choices.map((choice) => (
            <Button
              key={choice.value}
              type="button"
              variant={value === choice.value ? "default" : "outline"}
              disabled={disabled}
              className={cn("h-auto min-h-10 whitespace-normal px-4 py-2 text-left")}
              onClick={() => onChange(choice.value)}
            >
              {choice.label}
            </Button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Label htmlFor="intake-text-answer">Your answer</Label>
      <Textarea
        id="intake-text-answer"
        value={value}
        disabled={disabled}
        rows={4}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Type your answer here..."
      />
    </div>
  );
}

export function intakeQuestionSupportsAudio(question: IntakeQuestion): boolean {
  return intakeUsesFreeformResponse(question.answerType);
}

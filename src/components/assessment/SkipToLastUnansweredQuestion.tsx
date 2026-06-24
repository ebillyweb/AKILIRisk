"use client";

import { useMemo } from "react";
import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  shouldShowSkipToLastUnanswered,
} from "@/lib/assessment/resolve-resume-index";
import type { Question } from "@/lib/assessment/types";

type SkipToLastUnansweredQuestionProps = {
  currentIndex: number;
  visibleQuestions: Question[];
  answers: Record<string, unknown>;
  skippedQuestions: string[];
  onJump: (targetIndex: number) => void;
};

export function SkipToLastUnansweredQuestion({
  currentIndex,
  visibleQuestions,
  answers,
  skippedQuestions,
  onJump,
}: SkipToLastUnansweredQuestionProps) {
  const { show, targetIndex } = useMemo(
    () =>
      shouldShowSkipToLastUnanswered(
        currentIndex,
        visibleQuestions,
        answers,
        skippedQuestions,
      ),
    [currentIndex, visibleQuestions, answers, skippedQuestions],
  );

  if (!show || targetIndex === null) {
    return null;
  }

  const targetNumber = targetIndex + 1;

  return (
    <div className="flex justify-end border-t border-border/50 pt-3">
      <Button
        type="button"
        variant="link"
        className="h-auto px-0 text-sm font-medium"
        onClick={() => onJump(targetIndex)}
      >
        Skip to last unanswered question
        <span className="text-muted-foreground font-normal">
          {" "}
          (question {targetNumber})
        </span>
        <ArrowRight className="size-4" />
      </Button>
    </div>
  );
}

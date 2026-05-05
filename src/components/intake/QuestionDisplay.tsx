"use client";

import { CircleHelp, Lightbulb } from "lucide-react";
import { QuestionTtsPlayButton } from "@/components/common/QuestionTtsPlayButton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { IntakeQuestion } from "@/lib/intake/types";

/**
 * Question Display Component
 *
 * Displays intake interview questions with prominent text hierarchy.
 * Follows the Akili Risk editorial design patterns for clean, focused UX.
 */

interface QuestionDisplayProps {
  question: IntakeQuestion;
  totalQuestions: number;
}

export function QuestionDisplay({ question, totalQuestions }: QuestionDisplayProps) {
  const tooltipText = question.whyThisMatters?.trim();

  return (
    <div className="py-8 sm:py-12 max-w-2xl mx-auto">
      {/* Question number - editorial kicker style */}
      <div className="editorial-kicker text-sm text-muted-foreground uppercase tracking-wider mb-4">
        Question {question.questionNumber} of {totalQuestions}
      </div>

      {/* Question text - prominent heading */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 flex-1 items-start gap-2">
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-foreground">
            {question.questionText}
          </h1>
          {tooltipText ? (
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className="mt-1.5 shrink-0 rounded-md text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    aria-label="Why we ask this"
                  >
                    <CircleHelp className="size-5" aria-hidden />
                  </button>
                </TooltipTrigger>
                <TooltipContent
                  side="bottom"
                  align="start"
                  className="max-h-48 max-w-xs overflow-y-auto text-left text-xs font-normal sm:max-w-md"
                >
                  {tooltipText}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : null}
        </div>
        <QuestionTtsPlayButton
          contentKey={question.id}
          endpoint="/api/intake/tts"
          questionText={question.questionText}
          context={question.context}
          recordingTips={question.recordingTips}
          questionNumber={question.questionNumber}
          totalQuestions={totalQuestions}
          className="shrink-0"
        />
      </div>

      {/* Recording tips with subtle styling */}
      {question.recordingTips && question.recordingTips.length > 0 && (
        <div className="mb-8 space-y-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Lightbulb className="size-4" />
            <span className="font-medium">Recording Tips</span>
          </div>
          <ul className="space-y-2 text-sm text-muted-foreground pl-6">
            {question.recordingTips.map((tip, index) => (
              <li key={index} className="flex items-start gap-2">
                <span className="w-1 h-1 rounded-full bg-muted-foreground/60 mt-2 shrink-0" />
                <span>{tip}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

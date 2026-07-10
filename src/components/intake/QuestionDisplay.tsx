"use client";

import { Lightbulb } from "lucide-react";
import { QuestionTtsPlayButton } from "@/components/common/QuestionTtsPlayButton";
import { intakeContextForDisplay } from "@/lib/intake/intake-context-display";
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
  /** 1-based position in the active script (wizard step), not legacy bank numbering. */
  scriptPosition: number;
}

export function QuestionDisplay({
  question,
  totalQuestions,
  scriptPosition,
}: QuestionDisplayProps) {
  const coachingContext = intakeContextForDisplay(question.context);

  return (
    <div className="py-8 sm:py-12 max-w-2xl mx-auto">
      {/* Question number - editorial kicker style */}
      <div className="editorial-kicker text-sm text-muted-foreground uppercase tracking-wider mb-4">
        Question {scriptPosition} of {totalQuestions}
      </div>

      {/* Question text - prominent heading */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <h1 className="min-w-0 flex-1 text-2xl sm:text-3xl font-semibold tracking-tight text-foreground">
          {question.questionText}
        </h1>
        <QuestionTtsPlayButton
          contentKey={question.id}
          endpoint="/api/intake/tts"
          questionText={question.questionText}
          context={question.context}
          recordingTips={question.recordingTips}
          questionNumber={scriptPosition}
          totalQuestions={totalQuestions}
          className="shrink-0"
        />
      </div>

      {coachingContext ? (
        <div className="mb-8 rounded-xl border border-border/60 bg-muted/40 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Context
          </p>
          <p className="mt-2 text-sm leading-6 text-foreground/90">{coachingContext}</p>
        </div>
      ) : null}

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

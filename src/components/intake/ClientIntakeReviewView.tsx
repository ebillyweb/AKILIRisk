"use client";

import { AudioPlayer } from "@/components/advisor/AudioPlayer";
import { Badge } from "@/components/ui/badge";
import { formatIntakeAnswerDisplay } from "@/lib/pdf/intake/format-intake-answer";
import type { ClientIntakeReviewResponse } from "@/lib/client/intake-review";
import type { IntakeQuestion } from "@/lib/intake/types";
import { intakeResponseHasClientAnswer } from "@/lib/intake/response-has-answer";

type Props = {
  questions: IntakeQuestion[];
  responses: ClientIntakeReviewResponse[];
};

export function ClientIntakeReviewView({ questions, responses }: Props) {
  const responseByQuestionId = Object.fromEntries(
    responses.map((response) => [response.questionId, response]),
  );

  return (
    <div className="space-y-8">
      {questions.map((question) => {
        const response = responseByQuestionId[question.id];
        const num =
          question.questionNumber ??
          (parseInt(question.id.replace("intake-q", ""), 10) || 0);
        const hasAnswer =
          response != null && intakeResponseHasClientAnswer(response);
        const formatted = formatIntakeAnswerDisplay(
          response
            ? {
                audioUrl: response.audioUrl,
                transcription: response.transcription,
                transcriptionStatus: response.transcriptionStatus,
              }
            : undefined,
        );

        return (
          <section
            key={question.id}
            className="space-y-4 rounded-3xl border bg-card p-6 shadow-sm"
            data-testid={`client-intake-question-${question.id}`}
          >
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Question {num}
              </p>
              <h3 className="text-lg font-medium leading-7">
                {question.questionText}
              </h3>
            </div>

            <div className="space-y-3 border-t pt-4">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Your answer
                </p>
                {formatted.answerLabel ? (
                  <Badge variant="secondary" className="text-xs">
                    {formatted.answerLabel}
                  </Badge>
                ) : null}
              </div>

              {hasAnswer && response?.audioUrl ? (
                <AudioPlayer
                  audioUrl={response.audioUrl}
                  duration={response.audioDuration ?? undefined}
                  questionLabel={`Q${num}`}
                />
              ) : null}

              <div className="rounded-lg bg-muted/50 p-4">
                <p className="text-sm leading-6">{formatted.answerText}</p>
              </div>
            </div>
          </section>
        );
      })}

      {questions.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No intake questions are configured.
        </p>
      ) : null}
    </div>
  );
}

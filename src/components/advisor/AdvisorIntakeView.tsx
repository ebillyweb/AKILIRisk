"use client";

import { CircleHelp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { AudioPlayer } from "./AudioPlayer";
import { AnswerAdvisorNotePanel } from "./AnswerAdvisorNotePanel";
import {
  deleteIntakeResponseAdvisorNote,
  saveIntakeResponseAdvisorNote,
} from "@/lib/actions/advisor-answer-note-actions";
import type { IntakeReviewData } from "@/lib/advisor/types";

interface AdvisorIntakeViewProps {
  responses: IntakeReviewData["interview"]["responses"];
  questions: IntakeReviewData["questions"];
  totalQuestions: number;
}

/**
 * Advisor view: question text (read-only) and the client's recorded or typed answer.
 */
export function AdvisorIntakeView({
  responses,
  questions,
  totalQuestions,
}: AdvisorIntakeViewProps) {
  const responseByQuestionId = responses.reduce(
    (acc, r) => {
      acc[r.questionId] = r;
      return acc;
    },
    {} as Record<string, (typeof responses)[0]>,
  );

  return (
    <div className="space-y-10">
      {questions.map((question) => {
        const response = responseByQuestionId[question.id];
        const num =
          question.questionNumber ??
          (parseInt(question.id.replace("intake-q", ""), 10) || 0);
        return (
          <section key={question.id} className="space-y-4 rounded-lg border bg-card p-6">
            <QuestionBlock
              question={question}
              questionNumber={num}
              totalQuestions={totalQuestions}
            />
            <ClientResponseBlock response={response} questionNumber={num} />
            {response ? (
              <AnswerAdvisorNotePanel
                targetLabel={`intake Q${num}`}
                initialNote={response.advisorNote ?? null}
                onSave={(body) =>
                  saveIntakeResponseAdvisorNote({
                    intakeResponseId: response.id,
                    body,
                  })
                }
                onDelete={() => deleteIntakeResponseAdvisorNote(response.id)}
              />
            ) : null}
          </section>
        );
      })}
      {questions.length === 0 && (
        <div className="rounded-lg border bg-muted/30 p-8 text-center text-muted-foreground">
          No questions in this intake.
        </div>
      )}
    </div>
  );
}

function QuestionBlock({
  question,
  questionNumber,
  totalQuestions,
}: {
  question: IntakeReviewData["questions"][0];
  questionNumber: number;
  totalQuestions: number;
}) {
  const text = question.questionText ?? question.text;
  const tooltipText = question.whyThisMatters?.trim();

  return (
    <div className="space-y-3">
      <div className="editorial-kicker text-sm text-muted-foreground uppercase tracking-wider">
        Question {questionNumber} of {totalQuestions}
      </div>
      <div className="flex min-w-0 flex-1 items-start gap-2">
        <h3 className="text-lg font-medium leading-7 text-foreground sm:text-xl">
          {text}
        </h3>
        {tooltipText ? (
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className="mt-0.5 shrink-0 rounded-md text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
    </div>
  );
}

function ClientResponseBlock({
  response,
  questionNumber,
}: {
  response: IntakeReviewData["interview"]["responses"][0] | undefined;
  questionNumber: number;
}) {
  if (!response) {
    return (
      <div className="rounded-lg bg-muted/30 p-4">
        <p className="text-sm italic text-muted-foreground">No response recorded for this question.</p>
      </div>
    );
  }

  const hasVoiceRecording = Boolean(response.audioUrl);
  const hasTypedAnswer =
    Boolean(response.transcription?.trim()) && !hasVoiceRecording;

  return (
    <div className="space-y-3 border-t pt-4">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Client response — Question {questionNumber}
        </p>
        {hasTypedAnswer ? (
          <Badge variant="secondary" className="text-xs">
            Typed answer
          </Badge>
        ) : null}
      </div>
      {hasVoiceRecording && response.audioUrl && (
        <AudioPlayer
          audioUrl={response.audioUrl}
          duration={response.audioDuration ?? undefined}
          questionLabel={`Q${questionNumber}`}
        />
      )}
      <div className="rounded-lg bg-muted/50 p-4">
        {response.transcriptionStatus === "FAILED" && (
          <Badge variant="secondary" className="mb-2 text-xs">
            Transcription failed
          </Badge>
        )}
        {response.transcription ? (
          <p className="text-sm leading-6 text-foreground/90">{response.transcription}</p>
        ) : (
          <p className="text-sm italic text-muted-foreground">
            {hasVoiceRecording
              ? "Transcript pending or unavailable."
              : "No transcript available."}
          </p>
        )}
      </div>
    </div>
  );
}

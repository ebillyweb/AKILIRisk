"use client";

import { Badge } from "@/components/ui/badge";
import { StaffQuestionContextPanels } from "@/components/staff/StaffQuestionContextPanels";
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
  clientUserId: string;
}

/**
 * Advisor view: question text (read-only) and the client's recorded or typed answer.
 */
export function AdvisorIntakeView({
  responses,
  questions,
  totalQuestions,
  clientUserId,
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
            <StaffQuestionContextPanels
              whyThisMatters={question.whyThisMatters}
              recommendedActions={question.recommendedActions}
              questionId={question.id}
              questionLabel={question.questionText ?? question.text}
              clientUserId={clientUserId}
              source="intake"
            />
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

  return (
    <div className="space-y-3">
      <div className="editorial-kicker text-sm text-muted-foreground uppercase tracking-wider">
        Question {questionNumber} of {totalQuestions}
      </div>
      <h3 className="text-lg font-medium leading-7 text-foreground sm:text-xl">{text}</h3>
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

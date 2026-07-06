"use client";

import { AudioPlayer } from "@/components/advisor/AudioPlayer";
import { StaffQuestionContextPanels } from "@/components/staff/StaffQuestionContextPanels";
import { Badge } from "@/components/ui/badge";
import { AnswerAdminNotePanel } from "@/components/admin/AnswerAdminNotePanel";
import type { AdminIntakeReviewPayload } from "@/lib/admin/intake-review-queries";
import {
  deleteIntakeResponseAdminNote,
  saveIntakeResponseAdminNote,
} from "@/lib/actions/admin-answer-note-actions";
import { formatIntakeAnswerDisplay } from "@/lib/pdf/intake/format-intake-answer";

type Props = {
  data: AdminIntakeReviewPayload;
};

export function AdminIntakeReviewView({ data }: Props) {
  const { interview, questions } = data;
  const responseByQuestionId = Object.fromEntries(
    interview.responses.map((r) => [r.questionId, r])
  );

  return (
    <div className="space-y-8">
      {questions.map((question) => {
        const response = responseByQuestionId[question.id];
        const num =
          question.questionNumber ??
          (parseInt(question.id.replace("intake-q", ""), 10) || 0);
        const formatted = response
          ? formatIntakeAnswerDisplay(
              {
                audioUrl: response.audioUrl,
                transcription: response.transcription,
                transcriptionStatus: response.transcriptionStatus,
              },
              {
                answerType: question.answerType,
                answer0: question.answer0,
                answer1: question.answer1,
                answer2: question.answer2,
                answer3: question.answer3,
                options: question.options,
              },
            )
          : null;

        return (
          <section
            key={question.id}
            className="space-y-4 rounded-lg border bg-card p-6"
            data-testid={`admin-intake-question-${question.id}`}
          >
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Question {num}
              </p>
              <h3 className="text-lg font-semibold leading-snug">
                {question.questionText}
              </h3>
            </div>

            {response ? (
              <>
                <div className="space-y-3 border-t pt-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Client answer
                    </p>
                    {formatted?.answerLabel ? (
                      <Badge variant="secondary" className="text-xs">
                        {formatted.answerLabel}
                      </Badge>
                    ) : null}
                  </div>
                  {response.audioUrl ? (
                    <AudioPlayer
                      audioUrl={response.audioUrl}
                      duration={response.audioDuration ?? undefined}
                      questionLabel={`Q${num}`}
                    />
                  ) : null}
                  <div className="rounded-lg bg-muted/50 p-4">
                    {formatted?.answerKind === "transcription_failed" ? (
                      <Badge variant="secondary" className="mb-2 text-xs">
                        Transcription failed
                      </Badge>
                    ) : null}
                    {formatted && formatted.answerKind !== "missing" ? (
                      <p className="text-sm leading-6">{formatted.answerText}</p>
                    ) : (
                      <p className="text-sm italic text-muted-foreground">
                        No transcription available.
                      </p>
                    )}
                  </div>
                </div>
                <StaffQuestionContextPanels
                  whyThisMatters={question.whyThisMatters}
                  recommendedActions={question.recommendedActions}
                  questionId={question.id}
                  questionLabel={question.questionText}
                  clientUserId={interview.user.id}
                  source="intake"
                />
                <AnswerAdminNotePanel
                  targetLabel={`intake Q${num}`}
                  initialNote={response.adminNote}
                  onSave={(body) =>
                    saveIntakeResponseAdminNote({
                      intakeResponseId: response.id,
                      body,
                    })
                  }
                  onDelete={() => deleteIntakeResponseAdminNote(response.id)}
                />
              </>
            ) : (
              <>
                <p className="text-sm italic text-muted-foreground border-t pt-4">
                  No client response — admin notes can be added once an answer is recorded.
                </p>
                <StaffQuestionContextPanels
                  whyThisMatters={question.whyThisMatters}
                  recommendedActions={question.recommendedActions}
                  questionId={question.id}
                  questionLabel={question.questionText}
                  clientUserId={interview.user.id}
                  source="intake"
                />
              </>
            )}
          </section>
        );
      })}
      {questions.length === 0 ? (
        <p className="text-sm text-muted-foreground">No intake questions configured.</p>
      ) : null}
    </div>
  );
}

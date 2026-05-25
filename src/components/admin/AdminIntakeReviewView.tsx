"use client";

import { AudioPlayer } from "@/components/advisor/AudioPlayer";
import { Badge } from "@/components/ui/badge";
import { AnswerAdminNotePanel } from "@/components/admin/AnswerAdminNotePanel";
import type { AdminIntakeReviewPayload } from "@/lib/admin/intake-review-queries";
import {
  deleteIntakeResponseAdminNote,
  saveIntakeResponseAdminNote,
} from "@/lib/actions/admin-answer-note-actions";

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
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Client answer
                  </p>
                  {response.audioUrl ? (
                    <AudioPlayer
                      audioUrl={response.audioUrl}
                      duration={response.audioDuration ?? undefined}
                      questionLabel={`Q${num}`}
                    />
                  ) : null}
                  <div className="rounded-lg bg-muted/50 p-4">
                    {response.transcriptionStatus === "FAILED" ? (
                      <Badge variant="secondary" className="mb-2 text-xs">
                        Transcription failed
                      </Badge>
                    ) : null}
                    {response.transcription ? (
                      <p className="text-sm leading-6">{response.transcription}</p>
                    ) : (
                      <p className="text-sm italic text-muted-foreground">
                        No transcription available.
                      </p>
                    )}
                  </div>
                </div>
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
              <p className="text-sm italic text-muted-foreground border-t pt-4">
                No client response — admin notes can be added once an answer is recorded.
              </p>
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

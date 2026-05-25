"use client";

import { AnswerAdminNotePanel } from "@/components/admin/AnswerAdminNotePanel";
import { formatAssessmentAnswerForDisplay } from "@/lib/admin/format-assessment-answer";
import type { AdminAssessmentReviewPayload } from "@/lib/admin/assessment-review-queries";
import {
  deleteAssessmentResponseAdminNote,
  saveAssessmentResponseAdminNote,
} from "@/lib/actions/admin-answer-note-actions";

type Props = {
  data: AdminAssessmentReviewPayload;
};

export function AdminAssessmentReviewView({ data }: Props) {
  const { assessment, questionsById } = data;

  return (
    <div className="space-y-8">
      {assessment.responses.length === 0 ? (
        <p className="text-sm text-muted-foreground">No assessment responses recorded yet.</p>
      ) : null}
      {assessment.responses.map((row, index) => {
        const question = questionsById[row.questionId];
        const label = question?.text ?? row.questionId;

        return (
          <section
            key={row.responseId}
            className="space-y-4 rounded-lg border bg-card p-6"
            data-testid={`admin-assessment-response-${row.responseId}`}
          >
            <div className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Response {index + 1} · {row.pillar}
                {row.subCategory ? ` · ${row.subCategory.replace(/-/g, " ")}` : ""}
              </p>
              <h3 className="text-lg font-semibold leading-snug">{label}</h3>
            </div>
            <div className="rounded-lg bg-muted/50 p-4 border-t pt-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-2">
                Client answer
              </p>
              <p className="text-sm leading-6 whitespace-pre-wrap">
                {formatAssessmentAnswerForDisplay(question, row.answer, row.skipped)}
              </p>
            </div>
            <AnswerAdminNotePanel
              targetLabel={label.slice(0, 48)}
              initialNote={row.adminNote}
              onSave={(body) =>
                saveAssessmentResponseAdminNote({
                  assessmentResponseId: row.responseId,
                  body,
                })
              }
              onDelete={() => deleteAssessmentResponseAdminNote(row.responseId)}
            />
          </section>
        );
      })}
    </div>
  );
}

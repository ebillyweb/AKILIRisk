"use client";

import { AnswerAdvisorNotePanel } from "@/components/advisor/AnswerAdvisorNotePanel";
import { StaffQuestionContextPanels } from "@/components/staff/StaffQuestionContextPanels";
import { formatAssessmentAnswerForDisplay } from "@/lib/admin/format-assessment-answer";
import { DocumentUploadReviewerFlag } from "@/components/assessment/DocumentUploadReviewerFlag";
import { StaleDateReviewerFlag } from "@/components/assessment/StaleDateReviewerFlag";
import type { AdvisorAssessmentReviewPayload } from "@/lib/advisor/assessment-review-queries";
import {
  deleteAssessmentResponseAdvisorNote,
  saveAssessmentResponseAdvisorNote,
} from "@/lib/actions/advisor-answer-note-actions";

type Props = {
  data: AdvisorAssessmentReviewPayload;
};

/**
 * US-46c: advisor surface for reviewing individual assessment answers and
 * attaching per-answer advisory notes. Mirrors AdminAssessmentReviewView
 * but pulls from a tenant-scoped query and writes via the advisor server
 * actions (which gate every mutation on an ACTIVE assignment).
 */
export function AdvisorAssessmentReviewView({ data }: Props) {
  const { assessment, questionsById } = data;

  return (
    <div className="space-y-8">
      {assessment.responses.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No assessment responses recorded yet.
        </p>
      ) : null}
      {assessment.responses.map((row, index) => {
        const question = questionsById[row.questionId];
        const label = question?.text ?? row.questionId;

        return (
          <section
            key={row.responseId}
            className="space-y-4 rounded-lg border bg-card p-6"
            data-testid={`advisor-assessment-response-${row.responseId}`}
          >
            <div className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Response {index + 1} · {row.pillar}
                {row.subCategory ? ` · ${row.subCategory.replace(/-/g, " ")}` : ""}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-lg font-semibold leading-snug">{label}</h3>
                <DocumentUploadReviewerFlag
                  questionType={question?.type}
                  answer={row.answer}
                  skipped={row.skipped}
                />
                <StaleDateReviewerFlag
                  questionType={question?.type}
                  answer={row.answer}
                />
              </div>
            </div>
            <div className="rounded-lg bg-muted/50 p-4 border-t pt-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-2">
                Client answer
              </p>
              <p className="text-sm leading-6 whitespace-pre-wrap">
                {formatAssessmentAnswerForDisplay(question, row.answer, row.skipped)}
              </p>
            </div>
            <StaffQuestionContextPanels
              whyThisMatters={question?.helpText}
              recommendedActions={question?.learnMore}
              questionId={row.questionId}
              questionLabel={label}
              clientUserId={assessment.user.id}
              pillar={row.pillar}
              source="assessment"
            />
            <AnswerAdvisorNotePanel
              targetLabel={label.slice(0, 48)}
              initialNote={row.advisorNote}
              onSave={(body) =>
                saveAssessmentResponseAdvisorNote({
                  assessmentResponseId: row.responseId,
                  body,
                })
              }
              onDelete={() => deleteAssessmentResponseAdvisorNote(row.responseId)}
            />
          </section>
        );
      })}
    </div>
  );
}

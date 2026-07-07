"use client";

import { useQuery } from "@tanstack/react-query";

import { AnswerAdvisorNotePanel } from "@/components/advisor/AnswerAdvisorNotePanel";
import {
  deleteAssessmentQuestionAdvisorNote,
  deleteIntakeQuestionAdvisorNote,
  getAssessmentQuestionAdvisorNote,
  getIntakeQuestionAdvisorNote,
  saveAssessmentQuestionAdvisorNote,
  saveIntakeQuestionAdvisorNote,
} from "@/lib/actions/advisor-answer-note-actions";

/**
 * Advisor-only note entry mounted inside the live facilitation flow so an
 * advisor can jot a private note while completing a question for a client.
 * Reuses AnswerAdvisorNotePanel (the same widget used on review screens) and
 * the existing per-advisor note infrastructure. Never rendered on client-facing
 * surfaces. Key this by question id so it reloads per question.
 */
type FacilitatedAnswerNoteProps =
  | {
      mode: "assessment";
      assessmentId: string;
      questionId: string;
      pillar: string;
      subCategory: string;
      targetLabel: string;
    }
  | {
      mode: "intake";
      interviewId: string;
      questionId: string;
      targetLabel: string;
    };

export function FacilitatedAnswerNote(props: FacilitatedAnswerNoteProps) {
  const { data, isPending } = useQuery({
    queryKey:
      props.mode === "assessment"
        ? ["advisor-note", "assessment", props.assessmentId, props.questionId]
        : ["advisor-note", "intake", props.interviewId, props.questionId],
    queryFn: () =>
      props.mode === "assessment"
        ? getAssessmentQuestionAdvisorNote({
            assessmentId: props.assessmentId,
            questionId: props.questionId,
          })
        : getIntakeQuestionAdvisorNote({
            interviewId: props.interviewId,
            questionId: props.questionId,
          }),
    staleTime: 0,
  });

  if (isPending) {
    return (
      <div className="rounded-lg border border-dashed border-sky-300/60 bg-sky-50/40 p-4 text-xs text-muted-foreground dark:border-sky-700/40 dark:bg-sky-950/20">
        Loading advisor note…
      </div>
    );
  }

  const onSave = (body: string) =>
    props.mode === "assessment"
      ? saveAssessmentQuestionAdvisorNote({
          assessmentId: props.assessmentId,
          questionId: props.questionId,
          pillar: props.pillar,
          subCategory: props.subCategory,
          body,
        })
      : saveIntakeQuestionAdvisorNote({
          interviewId: props.interviewId,
          questionId: props.questionId,
          body,
        });

  const onDelete = () =>
    props.mode === "assessment"
      ? deleteAssessmentQuestionAdvisorNote({
          assessmentId: props.assessmentId,
          questionId: props.questionId,
        })
      : deleteIntakeQuestionAdvisorNote({
          interviewId: props.interviewId,
          questionId: props.questionId,
        });

  return (
    <AnswerAdvisorNotePanel
      targetLabel={props.targetLabel}
      initialNote={data ? { body: data.body } : null}
      onSave={onSave}
      onDelete={onDelete}
    />
  );
}

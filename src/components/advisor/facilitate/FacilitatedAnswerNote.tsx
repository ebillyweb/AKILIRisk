"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import type { AdvisorAnswerNoteActionResult } from "@/lib/actions/advisor-answer-note-actions";
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
  const queryClient = useQueryClient();
  const queryKey =
    props.mode === "assessment"
      ? ["advisor-note", "assessment", props.assessmentId, props.questionId]
      : ["advisor-note", "intake", props.interviewId, props.questionId];

  const { data, isPending, isError, refetch } = useQuery({
    queryKey,
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
    // Cache per question so navigating back doesn't refetch; save/delete below
    // invalidate this key so a later visit re-reads the latest note.
    staleTime: 60_000,
  });

  if (isPending) {
    return (
      <div className="rounded-lg border border-dashed border-sky-300/60 bg-sky-50/40 p-4 text-xs text-muted-foreground dark:border-sky-700/40 dark:bg-sky-950/20">
        Loading advisor note…
      </div>
    );
  }

  // Don't render an editable (empty) panel if the existing note failed to load —
  // saving from a blank box would overwrite a note the advisor can't see.
  if (isError) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-lg border border-dashed border-sky-300/60 bg-sky-50/40 p-4 text-xs text-muted-foreground dark:border-sky-700/40 dark:bg-sky-950/20">
        <span>Couldn&apos;t load the advisor note.</span>
        <Button type="button" variant="outline" size="sm" onClick={() => refetch()}>
          Retry
        </Button>
      </div>
    );
  }

  const invalidateOnSuccess = async (
    result: AdvisorAnswerNoteActionResult,
  ): Promise<AdvisorAnswerNoteActionResult> => {
    if (result.success) {
      await queryClient.invalidateQueries({ queryKey });
    }
    return result;
  };

  const onSave = (body: string) =>
    (props.mode === "assessment"
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
        })
    ).then(invalidateOnSuccess);

  const onDelete = () =>
    (props.mode === "assessment"
      ? deleteAssessmentQuestionAdvisorNote({
          assessmentId: props.assessmentId,
          questionId: props.questionId,
        })
      : deleteIntakeQuestionAdvisorNote({
          interviewId: props.interviewId,
          questionId: props.questionId,
        })
    ).then(invalidateOnSuccess);

  return (
    <AnswerAdvisorNotePanel
      targetLabel={props.targetLabel}
      initialNote={data ? { body: data.body } : null}
      onSave={onSave}
      onDelete={onDelete}
    />
  );
}

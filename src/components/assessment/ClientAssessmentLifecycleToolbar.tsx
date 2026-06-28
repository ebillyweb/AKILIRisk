"use client";

import { useRouter } from "next/navigation";
import { ReassessmentDialog } from "@/components/assessment/ReassessmentDialog";
import { RequestRescoreButton } from "@/components/assessment/RequestRescoreButton";

type ClientAssessmentLifecycleToolbarProps = {
  assessmentId: string;
  assessmentStatus: string;
  showStaleScoresActions: boolean;
  reassessmentEnabled: boolean;
  targetedQuestionCount: number;
  variant?: "inline" | "stacked";
};

export function ClientAssessmentLifecycleToolbar({
  assessmentId,
  assessmentStatus,
  showStaleScoresActions,
  reassessmentEnabled,
  targetedQuestionCount,
  variant = "inline",
}: ClientAssessmentLifecycleToolbarProps) {
  const router = useRouter();
  const isCompleted = assessmentStatus === "COMPLETED";
  const showReassessment = reassessmentEnabled && isCompleted;

  if (!showStaleScoresActions && !showReassessment) {
    return null;
  }

  return (
    <div
      className={
        variant === "stacked"
          ? "space-y-3"
          : "flex flex-col gap-2 border-t border-border pt-4 sm:flex-row sm:flex-wrap sm:items-center"
      }
      data-tour="client-assessment-lifecycle"
    >
      {showStaleScoresActions ? <RequestRescoreButton assessmentId={assessmentId} /> : null}
      {showReassessment ? (
        <ReassessmentDialog
          assessmentId={assessmentId}
          targetedQuestionCount={targetedQuestionCount}
          onReassessmentStarted={() => {
            router.refresh();
          }}
        />
      ) : null}
    </div>
  );
}

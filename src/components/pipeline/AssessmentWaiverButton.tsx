"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { FileText, Undo2 } from "lucide-react";
import { toast } from "react-hot-toast";

import { setClientAssessmentWaiver } from "@/lib/actions/advisor-assessment-waiver-actions";
import { Button } from "@/components/ui/button";
import { SIDEBAR_ACTION_BTN } from "@/components/pipeline/sidebar-action-button";

type Props = {
  clientId: string;
  assessmentWaivedAt: Date | null;
  /** Intake must be complete (submitted or waived) before assessment can be waived. */
  intakeComplete: boolean;
  /** If assessment has started, waiver is no longer allowed. */
  assessmentStarted: boolean;
};

export function AssessmentWaiverButton({
  clientId,
  assessmentWaivedAt,
  intakeComplete,
  assessmentStarted,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const isWaived = assessmentWaivedAt != null;

  const canWaive = intakeComplete && !assessmentStarted;
  const canUndo = isWaived && !assessmentStarted;

  function run() {
    const confirmMessage = isWaived
      ? "Undo skip to reporting? The client will need to complete the assessment."
      : "Skip assessment and go directly to reporting? The client will not complete the personal risk profile questionnaire.";

    if (!window.confirm(confirmMessage)) return;

    startTransition(async () => {
      const result = await setClientAssessmentWaiver(clientId, !isWaived);

      if (!result.success) {
        toast.error(result.error ?? "Could not update assessment waiver.");
        return;
      }
      toast.success(
        isWaived
          ? "Assessment waiver removed. Client can now complete assessment."
          : "Assessment skipped. Client goes directly to reporting.",
      );
      router.refresh();
    });
  }

  if (assessmentStarted && !isWaived) {
    return null;
  }

  if (!intakeComplete && !isWaived) {
    return null;
  }

  return (
    <Button
      type="button"
      variant={isWaived ? "outline" : "secondary"}
      className={SIDEBAR_ACTION_BTN}
      disabled={pending || (!canWaive && !canUndo)}
      onClick={run}
    >
      {isWaived ? (
        <>
          <Undo2 className="h-3.5 w-3.5 shrink-0" />
          Undo skip to reporting
        </>
      ) : (
        <>
          <FileText className="h-3.5 w-3.5 shrink-0" />
          Skip to reporting
        </>
      )}
    </Button>
  );
}

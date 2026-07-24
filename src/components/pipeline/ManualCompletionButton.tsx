"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { CheckCircle2, Undo2 } from "lucide-react";
import { toast } from "react-hot-toast";

import {
  markEngagementComplete,
  undoEngagementCompletion,
} from "@/lib/actions/advisor-manual-completion-actions";
import { Button } from "@/components/ui/button";
import { SIDEBAR_ACTION_BTN } from "@/components/pipeline/sidebar-action-button";

type Props = {
  clientId: string;
  manuallyCompletedAt: Date | null;
};

export function ManualCompletionButton({ clientId, manuallyCompletedAt }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const isComplete = manuallyCompletedAt != null;

  function run() {
    const confirmMessage = isComplete
      ? "Undo manual completion? The engagement will return to its workflow-determined status."
      : "Mark this engagement as complete? This overrides the workflow status and skips remaining steps.";

    if (!window.confirm(confirmMessage)) return;

    startTransition(async () => {
      const result = isComplete
        ? await undoEngagementCompletion(clientId)
        : await markEngagementComplete(clientId);

      if (!result.success) {
        toast.error(result.error ?? "Could not update completion status.");
        return;
      }
      toast.success(
        isComplete
          ? "Manual completion undone."
          : "Engagement marked as complete.",
      );
      router.refresh();
    });
  }

  return (
    <Button
      type="button"
      variant={isComplete ? "outline" : "default"}
      className={SIDEBAR_ACTION_BTN}
      disabled={pending}
      onClick={run}
    >
      {isComplete ? (
        <>
          <Undo2 className="h-3.5 w-3.5 shrink-0" />
          Undo completion
        </>
      ) : (
        <>
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
          Mark complete
        </>
      )}
    </Button>
  );
}

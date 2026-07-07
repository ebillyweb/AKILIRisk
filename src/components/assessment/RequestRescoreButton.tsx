"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { advisorRescoreAssessment } from "@/lib/actions/advisor-rescore-actions";
import { STALE_SCORES_COPY } from "@/lib/advisor/assessment-lifecycle-copy";
import { Button } from "@/components/ui/button";

export function RequestRescoreButton({
  assessmentId,
  size = "sm",
}: {
  assessmentId: string;
  size?: "sm" | "default";
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [doneVersion, setDoneVersion] = useState<number | null>(null);

  function handleClick() {
    setError(null);
    startTransition(async () => {
      const result = await advisorRescoreAssessment({ assessmentId });
      if (result.success) {
        setDoneVersion(result.data.newVersion);
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  if (doneVersion != null) {
    return (
      <p className="text-xs text-emerald-700 dark:text-emerald-300">
        Re-scored to v{doneVersion}. Scores and recommendations are updated.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <Button
        type="button"
        size={size}
        variant="default"
        disabled={pending}
        onClick={handleClick}
      >
        {pending ? "Re-scoring…" : STALE_SCORES_COPY.rescoreButton}
      </Button>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}

"use client";

import { useState, useTransition } from "react";
import { ClipboardList, ListPlus, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { queuePillarActionForClient } from "@/lib/actions/pillar-action-queue-actions";

type StaffQuestionContextPanelsProps = {
  whyThisMatters?: string | null;
  recommendedActions?: string | null;
  questionId: string;
  questionLabel: string;
  /** When set, staff can queue the recommended action on the client's report draft. */
  clientUserId?: string;
  pillar?: string | null;
  source?: "intake" | "assessment";
};

export function StaffQuestionContextPanels({
  whyThisMatters,
  recommendedActions,
  questionId,
  questionLabel,
  clientUserId,
  pillar,
  source = "assessment",
}: StaffQuestionContextPanelsProps) {
  const why = whyThisMatters?.trim();
  const actions = recommendedActions?.trim();
  if (!why && !actions) return null;

  return (
    <div className="space-y-3 border-t border-border/60 pt-4">
      {why ? (
        <div className="rounded-xl border border-border/70 bg-muted/30 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Why this matters
          </p>
          <p className="mt-2 text-sm leading-6 text-foreground/90">{why}</p>
        </div>
      ) : null}

      {actions ? (
        <div className="rounded-xl border-2 border-dashed border-brand/35 bg-brand/5 px-4 py-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1 space-y-2">
              <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-brand">
                <ClipboardList className="size-3.5 shrink-0" aria-hidden />
                Recommended actions
              </p>
              <p className="text-sm leading-6 text-foreground whitespace-pre-wrap">{actions}</p>
            </div>
            {clientUserId ? (
              <QueueActionButton
                clientUserId={clientUserId}
                questionId={questionId}
                questionLabel={questionLabel}
                actionText={actions}
                pillar={pillar}
                source={source}
              />
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function QueueActionButton({
  clientUserId,
  questionId,
  questionLabel,
  actionText,
  pillar,
  source,
}: {
  clientUserId: string;
  questionId: string;
  questionLabel: string;
  actionText: string;
  pillar?: string | null;
  source: "intake" | "assessment";
}) {
  const [queued, setQueued] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleQueue = () => {
    startTransition(async () => {
      const result = await queuePillarActionForClient({
        clientUserId,
        questionId,
        questionLabel,
        actionText,
        pillar,
        source,
      });
      if (!result.ok) {
        if (result.code === "duplicate") {
          setQueued(true);
        }
        toast.error(result.message);
        return;
      }
      setQueued(true);
      toast.success(
        (t) => (
          <span className="flex flex-col gap-1">
            <span>Added to report action queue.</span>
            <Link
              href={`/advisor/pipeline/${clientUserId}/report/edit`}
              className="text-xs underline"
              onClick={() => toast.dismiss(t.id)}
            >
              Open draft editor
            </Link>
          </span>
        ),
        { duration: 5000 }
      );
    });
  };

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="shrink-0"
      disabled={isPending || queued}
      onClick={handleQueue}
    >
      {isPending ? (
        <Loader2 className="size-4 animate-spin" aria-hidden />
      ) : (
        <ListPlus className="size-4" aria-hidden />
      )}
      {queued ? "Queued" : "Add to report queue"}
    </Button>
  );
}

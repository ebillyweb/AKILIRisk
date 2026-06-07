"use client";

import { useTransition } from "react";
import { Loader2, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { removeQueuedPillarAction } from "@/lib/actions/pillar-action-queue-actions";
import type { QueuedPillarAction } from "@/lib/reports/pillar-action-queue";

type Props = {
  reportId: string;
  actions: QueuedPillarAction[];
  onChange?: () => void;
};

export function QueuedPillarActionsPanel({ reportId, actions, onChange }: Props) {
  const [isPending, startTransition] = useTransition();

  if (actions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Report action queue</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Queue recommended actions from intake or assessment review using
            &quot;Add to report queue&quot; on each question. Queued items appear here
            for the risk profile draft, preview, and published report overlay.
          </p>
        </CardContent>
      </Card>
    );
  }

  const handleRemove = (actionId: string) => {
    startTransition(async () => {
      const result = await removeQueuedPillarAction({ reportId, actionId });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success("Removed from queue");
      onChange?.();
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Report action queue ({actions.length})</CardTitle>
        <p className="text-sm text-muted-foreground">
          Pillar recommended actions queued during client review. Included when you
          publish the risk profile report.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {actions.map((action) => (
          <div
            key={action.id}
            className="rounded-lg border-2 border-dashed border-brand/35 bg-brand/5 p-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 space-y-1">
                <p className="text-sm font-medium text-foreground">{action.questionLabel}</p>
                <p className="text-xs text-muted-foreground">
                  {action.source === "intake" ? "Intake" : "Assessment"}
                  {action.pillar ? ` · ${action.pillar.replace(/-/g, " ")}` : ""}
                </p>
                <p className="text-sm leading-6 text-foreground/90 whitespace-pre-wrap">
                  {action.actionText}
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={isPending}
                onClick={() => handleRemove(action.id)}
                aria-label="Remove from queue"
              >
                {isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Trash2 className="size-4" />
                )}
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

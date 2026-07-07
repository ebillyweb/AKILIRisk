"use client";

import { useState, useTransition } from "react";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { publishActionPlanAction } from "@/lib/actions/engagement-actions";

type PublishActionPlanButtonProps = {
  assessmentId: string;
  clientName: string;
  publishedAt: Date | null;
};

export function PublishActionPlanButton({
  assessmentId,
  clientName,
  publishedAt,
}: PublishActionPlanButtonProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  if (publishedAt) {
    return (
      <Badge variant="success" className="h-6">
        Published {format(publishedAt, "MMM d, yyyy")}
      </Badge>
    );
  }

  function handlePublish() {
    startTransition(async () => {
      const result = await publishActionPlanAction({ assessmentId });
      if (result.success) {
        setOpen(false);
      }
    });
  }

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        Publish Action Plan
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Publish action plan?</DialogTitle>
            <DialogDescription>
              {clientName} will be able to see their Strategic Action Plan and
              track progress on recommended actions.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setOpen(false)}
              disabled={isPending}
            >
              Not yet
            </Button>
            <Button onClick={handlePublish} disabled={isPending}>
              {isPending ? "Publishing..." : "Publish"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

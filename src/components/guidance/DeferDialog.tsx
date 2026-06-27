"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const DEFER_REASONS = [
  "Not a current priority",
  "Requires prerequisite action",
  "Budget constraints",
  "Timing not right",
  "Needs more information",
  "Other",
] as const;

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDefer: (data: {
    reason: string;
    revisitDate?: string;
    triggerEvent?: string;
    notes?: string;
  }) => Promise<void>;
  /** When set, dialog is being used for bulk defer */
  bulkCount?: number;
};

export function DeferDialog({ open, onOpenChange, onDefer, bulkCount }: Props) {
  const [reason, setReason] = useState("");
  const [revisitDate, setRevisitDate] = useState("");
  const [triggerEvent, setTriggerEvent] = useState("");
  const [notes, setNotes] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleConfirm() {
    if (!reason) return;

    startTransition(async () => {
      await onDefer({
        reason,
        revisitDate: revisitDate || undefined,
        triggerEvent: triggerEvent || undefined,
        notes: notes || undefined,
      });
      // Reset form
      setReason("");
      setRevisitDate("");
      setTriggerEvent("");
      setNotes("");
      onOpenChange(false);
    });
  }

  const title = bulkCount
    ? `Defer ${bulkCount} recommendation${bulkCount > 1 ? "s" : ""}`
    : "Defer this recommendation";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="defer-reason">Why are you deferring this?</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger id="defer-reason">
                <SelectValue placeholder="Select a reason" />
              </SelectTrigger>
              <SelectContent>
                {DEFER_REASONS.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="defer-revisit-date">
              Revisit date (optional)
            </Label>
            <Input
              id="defer-revisit-date"
              type="date"
              value={revisitDate}
              onChange={(e) => setRevisitDate(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="defer-trigger-event">
              Trigger event (optional)
            </Label>
            <Input
              id="defer-trigger-event"
              type="text"
              placeholder="e.g. After business valuation is complete"
              value={triggerEvent}
              onChange={(e) => setTriggerEvent(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="defer-notes">Additional notes (optional)</Label>
            <Textarea
              id="defer-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Back to recommendation
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!reason || isPending}
          >
            {isPending ? "Deferring..." : "Confirm Defer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

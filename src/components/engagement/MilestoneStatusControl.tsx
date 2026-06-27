"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  blockMilestone,
  deferMilestone,
  updateMilestoneStatusAction,
} from "@/lib/actions/engagement-actions";

const STATUS_OPTIONS = [
  { value: "NOT_STARTED", label: "Not Started" },
  { value: "IN_PROGRESS", label: "In Progress" },
  { value: "COMPLETED", label: "Completed" },
  { value: "SKIPPED", label: "Skipped" },
  { value: "BLOCKED", label: "Blocked" },
  { value: "DEFERRED", label: "Deferred" },
] as const;

type MilestoneStatusControlProps = {
  milestoneId: string;
  currentStatus: string;
};

export function MilestoneStatusControl({
  milestoneId,
  currentStatus,
}: MilestoneStatusControlProps) {
  const [blockOpen, setBlockOpen] = useState(false);
  const [deferOpen, setDeferOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [revisitDate, setRevisitDate] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleStatusChange(newStatus: string) {
    if (newStatus === currentStatus) return;

    if (newStatus === "BLOCKED") {
      setReason("");
      setBlockOpen(true);
      return;
    }

    if (newStatus === "DEFERRED") {
      setReason("");
      setRevisitDate("");
      setDeferOpen(true);
      return;
    }

    startTransition(async () => {
      await updateMilestoneStatusAction({
        milestoneId,
        status: newStatus as "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED" | "SKIPPED",
      });
    });
  }

  function handleBlock() {
    if (reason.length < 10) return;
    startTransition(async () => {
      const result = await blockMilestone({ milestoneId, reason });
      if (result.success) {
        setBlockOpen(false);
      }
    });
  }

  function handleDefer() {
    if (reason.length < 10) return;
    startTransition(async () => {
      const result = await deferMilestone({
        milestoneId,
        reason,
        revisitDate: revisitDate || undefined,
      });
      if (result.success) {
        setDeferOpen(false);
      }
    });
  }

  return (
    <>
      <Select
        value={currentStatus}
        onValueChange={handleStatusChange}
        disabled={isPending}
      >
        <SelectTrigger className="h-8 w-[140px] text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {STATUS_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value} className="text-xs">
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Block Dialog */}
      <Dialog open={blockOpen} onOpenChange={setBlockOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Block this milestone</DialogTitle>
            <DialogDescription>
              Explain what is preventing this milestone from moving forward.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="block-reason">What is blocking progress?</Label>
            <Textarea
              id="block-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Describe what is preventing this milestone from moving forward"
              minLength={10}
            />
            {reason.length > 0 && reason.length < 10 && (
              <p className="text-xs text-destructive">
                Reason must be at least 10 characters
              </p>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setBlockOpen(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleBlock}
              disabled={isPending || reason.length < 10}
            >
              {isPending ? "Blocking..." : "Block Milestone"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Defer Dialog */}
      <Dialog open={deferOpen} onOpenChange={setDeferOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Defer this milestone</DialogTitle>
            <DialogDescription>
              Provide a reason for deferring and optionally set a revisit date.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="defer-reason">Reason for deferral</Label>
              <Textarea
                id="defer-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Explain why this milestone is being deferred"
                minLength={10}
              />
              {reason.length > 0 && reason.length < 10 && (
                <p className="text-xs text-destructive">
                  Reason must be at least 10 characters
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="revisit-date">Revisit date (optional)</Label>
              <Input
                id="revisit-date"
                type="date"
                value={revisitDate}
                onChange={(e) => setRevisitDate(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setDeferOpen(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              variant="outline"
              onClick={handleDefer}
              disabled={isPending || reason.length < 10}
            >
              {isPending ? "Deferring..." : "Defer Milestone"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

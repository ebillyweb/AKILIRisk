"use client";

/**
 * BRD §6.3 / Epic 5.10 US-75 — Advisor status-advancement form.
 *
 * Wraps the `updateEngagementStatus` server action with a status-aware
 * UI. The allowed next-state set is hard-coded here to mirror the
 * server-side ALLOWED_TRANSITIONS table; the server is still the
 * authority — invalid transitions return `code: "invalid_status"` and
 * surface to the user, but they should not be reachable from this UI.
 */

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { PortfolioEngagementStatus } from "@prisma/client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { updateEngagementStatus } from "@/lib/actions/portfolio-engagement-actions";
import { ENGAGEMENT_STATUS_LABELS } from "../_status";

const NEXT_STATES: Record<PortfolioEngagementStatus, PortfolioEngagementStatus[]> = {
  ACCEPTED: ["MEETING_SCHEDULED", "IN_PROGRESS", "DECLINED"],
  MEETING_SCHEDULED: ["IN_PROGRESS", "ACCEPTED", "DECLINED"],
  IN_PROGRESS: ["COMPLETE", "DECLINED"],
  COMPLETE: [],
  DECLINED: [],
};

const ERROR_MESSAGES: Record<string, string> = {
  unauthenticated: "Please sign in again.",
  forbidden: "You can only manage your own engagements.",
  not_found: "This engagement no longer exists.",
  invalid_status: "That status change is not allowed from the current state.",
};

type Props = {
  engagementId: string;
  currentStatus: PortfolioEngagementStatus;
  defaultMeetingAt: Date | null;
  defaultNotes: string;
};

function toDateInputValue(d: Date | null): string {
  if (!d) return "";
  return d.toISOString().slice(0, 10);
}

export function EngagementStatusForm({
  engagementId,
  currentStatus,
  defaultMeetingAt,
  defaultNotes,
}: Props) {
  const router = useRouter();
  const [pendingTarget, setPendingTarget] =
    useState<PortfolioEngagementStatus | null>(null);
  const [meetingAtInput, setMeetingAtInput] = useState<string>(
    toDateInputValue(defaultMeetingAt)
  );
  const [notesInput, setNotesInput] = useState<string>(defaultNotes);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const allowed = useMemo(() => NEXT_STATES[currentStatus], [currentStatus]);

  const submit = (target: PortfolioEngagementStatus) => {
    setError(null);
    setPendingTarget(target);

    const meetingAt =
      target === "MEETING_SCHEDULED" && meetingAtInput
        ? new Date(meetingAtInput)
        : null;

    startTransition(async () => {
      try {
        const result = await updateEngagementStatus({
          engagementId,
          status: target,
          meetingScheduledAt: target === "MEETING_SCHEDULED" ? new Date() : undefined,
          meetingAt: meetingAt ?? undefined,
          notes: notesInput.trim() === defaultNotes.trim() ? undefined : notesInput,
        });
        if (result.ok) {
          router.refresh();
        } else {
          setError(ERROR_MESSAGES[result.code] ?? "Something went wrong.");
        }
      } catch {
        setError("Something went wrong. Please try again.");
      } finally {
        setPendingTarget(null);
      }
    });
  };

  if (allowed.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        This engagement is in a terminal state ({ENGAGEMENT_STATUS_LABELS[currentStatus]}).
        No further status changes are available.
      </p>
    );
  }

  return (
    <div className="space-y-5">
      {allowed.includes("MEETING_SCHEDULED") ? (
        <div className="space-y-2">
          <Label htmlFor="meetingAt">Meeting date (when scheduling)</Label>
          <Input
            id="meetingAt"
            type="date"
            value={meetingAtInput}
            onChange={(e) => setMeetingAtInput(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Required only when moving to “Meeting scheduled”. Other status
            changes ignore this field.
          </p>
        </div>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="notes">Advisor notes</Label>
        <Textarea
          id="notes"
          value={notesInput}
          onChange={(e) => setNotesInput(e.target.value)}
          placeholder="Internal notes about this engagement…"
          rows={4}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {allowed.map((target) => (
          <Button
            key={target}
            type="button"
            variant={target === "DECLINED" ? "outline" : "default"}
            disabled={isPending}
            aria-busy={isPending && pendingTarget === target}
            onClick={() => submit(target)}
          >
            {isPending && pendingTarget === target
              ? "Saving…"
              : `Move to ${ENGAGEMENT_STATUS_LABELS[target]}`}
          </Button>
        ))}
      </div>

      {error ? (
        <p className="text-sm font-medium text-red-700" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

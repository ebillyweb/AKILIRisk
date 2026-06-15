"use client";

import { useState, useTransition } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { ANSWER_ADVISOR_NOTE_MAX_LENGTH } from "@/lib/advisor/advisor-note-schemas";
import type { AdvisorAnswerNoteActionResult } from "@/lib/actions/advisor-answer-note-actions";

type Props = {
  targetLabel: string;
  initialNote: { body: string } | null;
  onSave: (body: string) => Promise<AdvisorAnswerNoteActionResult>;
  onDelete: () => Promise<AdvisorAnswerNoteActionResult>;
};

/**
 * US-46c: advisor advisory note on a single answer. Edits never touch the
 * underlying client answer or scoring. The note is private to the owning
 * advisor (and to platform staff for oversight); never visible to the
 * client. Sister to AnswerAdminNotePanel — separate channel, separate
 * styling so the two are visually distinguishable on the admin surfaces.
 */
export function AnswerAdvisorNotePanel({
  targetLabel,
  initialNote,
  onSave,
  onDelete,
}: Props) {
  const [body, setBody] = useState(initialNote?.body ?? "");
  const [savedBody, setSavedBody] = useState(initialNote?.body ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const hasNote = Boolean(savedBody.trim());
  const dirty = body.trim() !== savedBody.trim();

  function handleSave() {
    setError(null);
    startTransition(async () => {
      const result = await onSave(body);
      if (result.success) {
        const trimmed = body.trim();
        setBody(trimmed);
        setSavedBody(trimmed);
      } else {
        setError(result.error);
      }
    });
  }

  function handleDelete() {
    if (!hasNote) return;
    setError(null);
    startTransition(async () => {
      const result = await onDelete();
      if (result.success) {
        setBody("");
        setSavedBody("");
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <div
      className="rounded-lg border border-dashed border-sky-300/60 bg-sky-50/40 p-4 dark:border-sky-700/40 dark:bg-sky-950/20"
      data-testid="answer-advisor-note-panel"
    >
      <p className="text-xs font-medium uppercase tracking-wide text-sky-900/80 dark:text-sky-200/90">
        Advisor note — {targetLabel}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        Visible only to you and platform staff. Does not change the client
        answer or any score.
      </p>
      {hasNote && !dirty ? (
        <p
          className="mt-3 whitespace-pre-wrap text-sm leading-6 text-foreground"
          data-testid="answer-advisor-note-display"
        >
          {savedBody}
        </p>
      ) : null}
      <Textarea
        className="mt-3 min-h-[88px] bg-background"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        maxLength={ANSWER_ADVISOR_NOTE_MAX_LENGTH}
        placeholder="Add a private note on this question…"
        aria-label={`Advisor note for ${targetLabel}`}
        data-testid="answer-advisor-note-input"
      />
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          disabled={pending || !body.trim() || (!dirty && hasNote)}
          onClick={handleSave}
          data-testid="answer-advisor-note-save"
        >
          {hasNote ? "Update note" : "Save note"}
        </Button>
        {hasNote ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={handleDelete}
            data-testid="answer-advisor-note-delete"
          >
            Remove note
          </Button>
        ) : null}
        <span className="text-xs text-muted-foreground">
          {body.length}/{ANSWER_ADVISOR_NOTE_MAX_LENGTH}
        </span>
      </div>
      {error ? (
        <p className="mt-2 text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

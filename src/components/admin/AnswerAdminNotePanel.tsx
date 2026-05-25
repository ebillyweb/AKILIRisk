"use client";

import { useState, useTransition } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { ANSWER_ADMIN_NOTE_MAX_LENGTH } from "@/lib/admin/answer-note-schemas";
import type { AnswerNoteActionResult } from "@/lib/actions/admin-answer-note-actions";

type Props = {
  targetLabel: string;
  initialNote: { body: string } | null;
  onSave: (body: string) => Promise<AnswerNoteActionResult>;
  onDelete: () => Promise<AnswerNoteActionResult>;
};

/**
 * US-46b: platform-admin advisory note on a single answer.
 * Edits never touch the underlying client answer or scoring.
 */
export function AnswerAdminNotePanel({
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
      className="rounded-lg border border-dashed border-amber-300/60 bg-amber-50/40 p-4 dark:border-amber-700/40 dark:bg-amber-950/20"
      data-testid="answer-admin-note-panel"
    >
      <p className="text-xs font-medium uppercase tracking-wide text-amber-900/80 dark:text-amber-200/90">
        Platform admin note — {targetLabel}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        Advisory only. Does not change the client answer or any score.
      </p>
      {hasNote && !dirty ? (
        <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-foreground" data-testid="answer-admin-note-display">
          {savedBody}
        </p>
      ) : null}
      <Textarea
        className="mt-3 min-h-[88px] bg-background"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        maxLength={ANSWER_ADMIN_NOTE_MAX_LENGTH}
        placeholder="Add review context for the advisory team…"
        aria-label={`Admin note for ${targetLabel}`}
        data-testid="answer-admin-note-input"
      />
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          disabled={pending || !body.trim() || (!dirty && hasNote)}
          onClick={handleSave}
          data-testid="answer-admin-note-save"
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
            data-testid="answer-admin-note-delete"
          >
            Remove note
          </Button>
        ) : null}
        <span className="text-xs text-muted-foreground">
          {body.length}/{ANSWER_ADMIN_NOTE_MAX_LENGTH}
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

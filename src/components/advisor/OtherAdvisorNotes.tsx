type OtherAdvisorNote = {
  id: string;
  body: string;
  authorName: string;
};

/**
 * Read-only display of notes authored by other advisors on the same answer.
 * Shown to firm-scope (enterprise OWNER/ADMIN) reviewers so they can see notes
 * left by their advisors. Never rendered on client-facing surfaces.
 */
export function OtherAdvisorNotes({ notes }: { notes: OtherAdvisorNote[] }) {
  if (notes.length === 0) return null;

  return (
    <div className="space-y-2" data-testid="other-advisor-notes">
      {notes.map((note) => (
        <div
          key={note.id}
          className="rounded-lg border border-dashed border-sky-300/40 bg-sky-50/20 p-3 dark:border-sky-700/30 dark:bg-sky-950/10"
        >
          <p className="text-xs font-medium uppercase tracking-wide text-sky-900/70 dark:text-sky-200/80">
            Advisor note — {note.authorName}
          </p>
          <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-foreground">
            {note.body}
          </p>
        </div>
      ))}
    </div>
  );
}

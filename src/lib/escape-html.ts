/**
 * Escape HTML-significant characters in untrusted strings before embedding
 * them into an HTML template. Used by the email-rendering helpers under
 * `src/lib/{notifications,invitations,reminders,billing}/...` and
 * `src/lib/email.ts`.
 *
 * History: this same five-line function was copy-pasted into five files.
 * Consolidated here so future templates have one place to import from.
 *
 * Note: this escapes for HTML *element content* and *double-quoted attribute
 * values*. It does NOT escape for `<script>` bodies, URLs, or CSS — for those
 * contexts, additional encoding is required.
 */
export function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

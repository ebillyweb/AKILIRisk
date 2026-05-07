-- Round-11 commit 2.5a (BRD §5.1) — additive columns for response-content encryption.
--
-- Adds two columns; does NOT drop or rename anything. The bridge-write
-- application code lands in this same commit; commit 2.5b finalizes
-- the flip (drops plaintext columns, renames ciphertext columns).
--
-- IntakeResponse:
--   * hasTranscription BOOLEAN NOT NULL DEFAULT false — denormalized
--     "non-empty plaintext exists" flag. Required because once
--     `transcription` flips to ciphertext (commit 2.5b), the existing
--     `WHERE transcription IS NOT NULL AND transcription != ''` filter
--     in pipeline/queries.ts becomes meaningless (every ciphertext is a
--     non-null non-empty string). Bridge-write sets this from the
--     plaintext at every save site.
--
-- AssessmentResponse:
--   * answerCiphertext TEXT (nullable) — interim column for the
--     encrypted answer payload (JSON.stringify(answer) → encrypt).
--     Bridge-write populates it alongside the existing `answer Json`
--     column. Commit 2.5b drops `answer Json` and renames
--     `answerCiphertext` → `answer`.
--
-- Idempotent for partial-replay: IF NOT EXISTS guards.

ALTER TABLE "IntakeResponse"
  ADD COLUMN IF NOT EXISTS "hasTranscription" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "AssessmentResponse"
  ADD COLUMN IF NOT EXISTS "answerCiphertext" TEXT;

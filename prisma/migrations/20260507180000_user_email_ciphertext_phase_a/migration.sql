-- Round-11 commit 2.3 (BRD §5.1.AUTH / phase A — additive only).
--
-- Add a nullable `emailCiphertext` column for the deterministic AES-256-GCM
-- ciphertext of `User.email`. Phase A intentionally keeps the column nullable
-- and not unique; phase B (commit 2.4, gated behind a separate design review)
-- will:
--   1. Backfill remaining rows.
--   2. Drop the unique constraint on `email` and add it on `emailCiphertext`.
--   3. Make `emailCiphertext` NOT NULL.
--   4. Either drop `email` or repurpose it for a one-way hash + display
--      preview ("a***@example.com").
--
-- During phase A the application reads both columns (ciphertext-first, then
-- plaintext fallback) and writes both columns on every create / update, so
-- the upcoming phase-B flip is a pure column swap with no data movement
-- required.
ALTER TABLE "User" ADD COLUMN "emailCiphertext" TEXT;

-- Non-unique helper index for the dual-read fallback path. The index is
-- intentionally a regular B-tree (not unique) for phase A so we can land
-- this migration before the backfill completes; phase B will drop and
-- re-create it as UNIQUE.
CREATE INDEX "User_emailCiphertext_idx" ON "User"("emailCiphertext");

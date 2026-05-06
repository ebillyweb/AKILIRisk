-- Round-11 commit 2.4a (BRD §5.1.AUTH / phase B — soft-drop step 1).
--
-- Flip the auth-path lookup from plaintext `email` to deterministic
-- `emailCiphertext`. This migration:
--   1. Drops the phase-A non-unique helper index on emailCiphertext.
--   2. Adds a UNIQUE index on emailCiphertext as the new authoritative
--      lookup column.
--   3. Sets emailCiphertext NOT NULL — phase-A backfill must have run
--      to completion (sanity SQL: SELECT COUNT(*) FROM "User" WHERE
--      "emailCiphertext" IS NULL = 0; gate-checked in commit message).
--   4. Drops the unique constraint on plaintext email.
--   5. Drops the @@index([email]) helper if it exists.
--
-- The plaintext `email` column STAYS for the 7-day bake window; phase
-- B (commit 2.4b) drops the column once we're confident the auth path
-- is stable. Keeping the column means rollback during the bake window
-- is just `git revert` + redeploy + reverse migration — no data
-- restoration step.
--
-- Ordering: the UNIQUE index on emailCiphertext is created BEFORE the
-- old UNIQUE on email is dropped. There must never be a moment where
-- neither column has a uniqueness invariant, otherwise a concurrent
-- INSERT could land two rows with the same email between the two
-- statements.
--
-- All steps run in one transaction (Postgres default for a single
-- migration file). A partial-failure leaves the schema in phase-A
-- shape.

-- (1) Drop the phase-A B-tree.
DROP INDEX IF EXISTS "User_emailCiphertext_idx";

-- (2) Add the new authoritative UNIQUE.
CREATE UNIQUE INDEX "User_emailCiphertext_key" ON "User"("emailCiphertext");

-- (3) NOT NULL on the new authoritative column.
ALTER TABLE "User" ALTER COLUMN "emailCiphertext" SET NOT NULL;

-- (4) Drop the old plaintext UNIQUE constraint. This frees `email`
--     to allow duplicates; bake-window code paths must not depend on
--     email being unique.
ALTER TABLE "User" DROP CONSTRAINT "User_email_key";

-- (5) Drop the @@index([email]) helper. Auth-path readers no longer
--     query by email; the only callers reading email after this point
--     are display surfaces that already have a User by id.
DROP INDEX IF EXISTS "User_email_idx";

-- (6) Drop NOT NULL on the plaintext column. Application-level writes
--     stop populating `email` after this commit (userEmailWriteData
--     returns ciphertext-only), so the column has to allow NULL for
--     new rows. Existing rows keep their plaintext for display
--     surfaces during the bake window; commit 2.4b drops the column
--     entirely once we're confident the auth path is stable.
ALTER TABLE "User" ALTER COLUMN "email" DROP NOT NULL;

-- Round-11 commit 2.2 (BRD §5.1 amendment): HouseholdMember reduced to
-- demographic + relationship form. Names, ages (exact), occupations,
-- phones, emails, notes are dropped. The advisor sees household
-- composition by structure (sex × birthYear × relationship × roles)
-- without identifying any individual.
--
-- Migration order (PostgreSQL needs the enum type before any column can
-- reference it):
--   1. CREATE TYPE Sex
--   2. ADD 3 new columns (displayLabel nullable for backfill, sex,
--      birthYear)
--   3. Backfill displayLabel: "Member A" / "Member B" / ... per
--      partition by userId, ordered by createdAt. Falls back to
--      "Member 27" / "Member 28" / ... after Z (highly unlikely;
--      MVP households are < 26 members).
--   4. SET NOT NULL on displayLabel
--   5. DROP the 7 old columns (fullName, age, occupation, phone,
--      email, notes, shareNameAndContactWithAdvisor — the
--      share-flag has no behavioral effect once the fields it
--      gated are gone).
--
-- Existing data in the dropped columns is permanently lost
-- (acceptable per round-11 sign-off: "just drop"). The advisor-side
-- redaction logic that consumed the share-flag collapses to a
-- pass-through (advisor-household-view.ts).

CREATE TYPE "Sex" AS ENUM ('MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY');

ALTER TABLE "HouseholdMember"
  ADD COLUMN "displayLabel" TEXT,
  ADD COLUMN "sex"          "Sex",
  ADD COLUMN "birthYear"    INTEGER;

-- Backfill displayLabel for existing rows. ROW_NUMBER() per userId
-- partition gives a stable per-household ordinal; chr(64+n) maps
-- 1→A, 2→B, … 26→Z. Numeric fallback for n>26.
WITH ranked AS (
  SELECT id,
         "userId",
         ROW_NUMBER() OVER (PARTITION BY "userId" ORDER BY "createdAt", "id") AS n
  FROM "HouseholdMember"
)
UPDATE "HouseholdMember" hm
SET "displayLabel" =
  CASE
    WHEN ranked.n <= 26 THEN 'Member ' || chr(64 + ranked.n)
    ELSE 'Member ' || ranked.n::text
  END
FROM ranked
WHERE hm.id = ranked.id;

ALTER TABLE "HouseholdMember" ALTER COLUMN "displayLabel" SET NOT NULL;

ALTER TABLE "HouseholdMember"
  DROP COLUMN "fullName",
  DROP COLUMN "age",
  DROP COLUMN "occupation",
  DROP COLUMN "phone",
  DROP COLUMN "email",
  DROP COLUMN "notes",
  DROP COLUMN "shareNameAndContactWithAdvisor";

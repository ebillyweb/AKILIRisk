-- Intake questions use the same answer types and option labels as assessments.
ALTER TABLE "advisor_intake_questions"
  ADD COLUMN IF NOT EXISTS "answer_0" TEXT,
  ADD COLUMN IF NOT EXISTS "answer_1" TEXT,
  ADD COLUMN IF NOT EXISTS "answer_2" TEXT,
  ADD COLUMN IF NOT EXISTS "answer_3" TEXT;

ALTER TABLE "enterprise_intake_questions"
  ADD COLUMN IF NOT EXISTS "answer_0" TEXT,
  ADD COLUMN IF NOT EXISTS "answer_1" TEXT,
  ADD COLUMN IF NOT EXISTS "answer_2" TEXT,
  ADD COLUMN IF NOT EXISTS "answer_3" TEXT;

-- Backfill platform-linked intake rows from the platform intake bank.
UPDATE "advisor_intake_questions" ai
SET
  "answer_type" = q."answer_type",
  "answer_0" = q."answer_0",
  "answer_1" = q."answer_1",
  "answer_2" = q."answer_2",
  "answer_3" = q."answer_3"
FROM "questions" q
WHERE ai."platform_source_id" = q."id"
  AND ai."source_kind" = 'PLATFORM';

UPDATE "enterprise_intake_questions" ei
SET
  "answer_type" = q."answer_type",
  "answer_0" = q."answer_0",
  "answer_1" = q."answer_1",
  "answer_2" = q."answer_2",
  "answer_3" = q."answer_3"
FROM "questions" q
WHERE ei."platform_source_id" = q."id"
  AND ei."source_kind" = 'PLATFORM';

-- Legacy audio default → fillable for rows still using the old placeholder.
UPDATE "advisor_intake_questions"
SET "answer_type" = 'fillable'
WHERE "answer_type" = 'audio';

UPDATE "enterprise_intake_questions"
SET "answer_type" = 'fillable'
WHERE "answer_type" = 'audio';

ALTER TABLE "advisor_intake_questions"
  ALTER COLUMN "answer_type" SET DEFAULT 'fillable';

ALTER TABLE "enterprise_intake_questions"
  ALTER COLUMN "answer_type" SET DEFAULT 'fillable';

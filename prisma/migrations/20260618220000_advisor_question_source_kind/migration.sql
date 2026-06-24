-- Distinguish platform base questions (edit/hide only) from advisor-owned custom questions.
CREATE TYPE "AdvisorQuestionSource" AS ENUM ('PLATFORM', 'CUSTOM');

ALTER TABLE "advisor_pillar_questions"
  ADD COLUMN "source_kind" "AdvisorQuestionSource" NOT NULL DEFAULT 'PLATFORM',
  ADD COLUMN "platform_source_id" UUID;

ALTER TABLE "advisor_intake_questions"
  ADD COLUMN "source_kind" "AdvisorQuestionSource" NOT NULL DEFAULT 'PLATFORM',
  ADD COLUMN "platform_source_id" UUID;

ALTER TABLE "advisor_pillar_questions"
  ADD CONSTRAINT "advisor_pillar_questions_platform_source_id_fkey"
  FOREIGN KEY ("platform_source_id") REFERENCES "questions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "advisor_intake_questions"
  ADD CONSTRAINT "advisor_intake_questions_platform_source_id_fkey"
  FOREIGN KEY ("platform_source_id") REFERENCES "questions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE UNIQUE INDEX "advisor_pillar_questions_profile_platform_source_key"
  ON "advisor_pillar_questions" ("advisor_profile_id", "platform_source_id")
  WHERE "platform_source_id" IS NOT NULL;

CREATE UNIQUE INDEX "advisor_intake_questions_profile_platform_source_key"
  ON "advisor_intake_questions" ("advisor_profile_id", "platform_source_id")
  WHERE "platform_source_id" IS NOT NULL;

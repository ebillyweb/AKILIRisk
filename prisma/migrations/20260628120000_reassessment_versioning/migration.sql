-- Phase 24: Continuous Risk Improvement — Assessment versioning, SolutionActivity
-- evolution, ReviewCadence model, and AdvisorEnterprise cadence default.

-- 1. Assessment: add previousAssessmentId self-referential FK
ALTER TABLE "Assessment" ADD COLUMN "previous_assessment_id" TEXT;
ALTER TABLE "Assessment" ADD CONSTRAINT "Assessment_previous_assessment_id_fkey"
  FOREIGN KEY ("previous_assessment_id") REFERENCES "Assessment"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "Assessment_previous_assessment_id_idx" ON "Assessment"("previous_assessment_id");

-- 2. SolutionActivity: make assessmentRecommendationId nullable (D-11, Pitfall 1)
-- IMPORTANT: ALTER COLUMN DROP NOT NULL, not destructive recreate.
ALTER TABLE "solution_activities" ALTER COLUMN "assessment_recommendation_id" DROP NOT NULL;

-- 2b. SolutionActivity: add assessmentId FK for assessment-scoped events
ALTER TABLE "solution_activities" ADD COLUMN "assessment_id" TEXT;
ALTER TABLE "solution_activities" ADD CONSTRAINT "solution_activities_assessment_id_fkey"
  FOREIGN KEY ("assessment_id") REFERENCES "Assessment"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "solution_activities_assessment_id_idx" ON "solution_activities"("assessment_id");

-- 3. CadenceFrequency enum
CREATE TYPE "CadenceFrequency" AS ENUM ('QUARTERLY', 'SEMI_ANNUAL', 'ANNUAL');

-- 4. ReviewCadence model
CREATE TABLE "review_cadences" (
  "id" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "advisorProfileId" TEXT NOT NULL,
  "frequency" "CadenceFrequency" NOT NULL DEFAULT 'ANNUAL',
  "next_due_date" TIMESTAMP(3) NOT NULL,
  "last_assessment_id" TEXT,
  "last_reminder_sent_at" TIMESTAMP(3),
  "is_overridden" BOOLEAN NOT NULL DEFAULT false,
  "system_recommended" BOOLEAN NOT NULL DEFAULT false,
  "system_recommendation_reason" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "review_cadences_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "review_cadences" ADD CONSTRAINT "review_cadences_clientId_fkey"
  FOREIGN KEY ("clientId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "review_cadences" ADD CONSTRAINT "review_cadences_advisorProfileId_fkey"
  FOREIGN KEY ("advisorProfileId") REFERENCES "AdvisorProfile"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "review_cadences" ADD CONSTRAINT "review_cadences_last_assessment_id_fkey"
  FOREIGN KEY ("last_assessment_id") REFERENCES "Assessment"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE UNIQUE INDEX "review_cadences_clientId_advisorProfileId_key"
  ON "review_cadences"("clientId", "advisorProfileId");

CREATE INDEX "review_cadences_next_due_date_idx"
  ON "review_cadences"("next_due_date");

-- 5. AdvisorEnterprise: add defaultCadenceFrequency
ALTER TABLE "AdvisorEnterprise" ADD COLUMN "defaultCadenceFrequency" "CadenceFrequency" NOT NULL DEFAULT 'ANNUAL';

-- Epic 5.11 Phase 4: advisor-led facilitated sessions (US-73–75)

CREATE TYPE "FacilitatedSessionStatus" AS ENUM (
  'INTAKE',
  'PILLAR_SELECT',
  'ASSESSMENT',
  'PREVIEW',
  'COMPLETE'
);

CREATE TABLE "facilitated_sessions" (
  "id" TEXT NOT NULL,
  "client_id" TEXT NOT NULL,
  "advisor_profile_id" TEXT NOT NULL,
  "status" "FacilitatedSessionStatus" NOT NULL DEFAULT 'INTAKE',
  "interview_id" TEXT,
  "assessment_id" TEXT,
  "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completed_at" TIMESTAMP(3),
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "facilitated_sessions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "facilitated_sessions_client_id_advisor_profile_id_status_idx"
  ON "facilitated_sessions"("client_id", "advisor_profile_id", "status");
CREATE INDEX "facilitated_sessions_advisor_profile_id_status_idx"
  ON "facilitated_sessions"("advisor_profile_id", "status");

ALTER TABLE "facilitated_sessions"
  ADD CONSTRAINT "facilitated_sessions_client_id_fkey"
  FOREIGN KEY ("client_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "facilitated_sessions"
  ADD CONSTRAINT "facilitated_sessions_advisor_profile_id_fkey"
  FOREIGN KEY ("advisor_profile_id") REFERENCES "AdvisorProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

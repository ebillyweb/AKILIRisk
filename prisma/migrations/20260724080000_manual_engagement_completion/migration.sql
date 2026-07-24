-- Manual engagement completion: allows advisors to mark engagements as complete
-- at any stage, bypassing the normal workflow completion requirements.

ALTER TABLE "ClientAdvisorAssignment"
  ADD COLUMN "manuallyCompletedAt" TIMESTAMP(3),
  ADD COLUMN "manuallyCompletedByAdvisorId" TEXT;

-- Add foreign key constraint
ALTER TABLE "ClientAdvisorAssignment"
  ADD CONSTRAINT "ClientAdvisorAssignment_manuallyCompletedByAdvisorId_fkey"
  FOREIGN KEY ("manuallyCompletedByAdvisorId")
  REFERENCES "AdvisorProfile"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;

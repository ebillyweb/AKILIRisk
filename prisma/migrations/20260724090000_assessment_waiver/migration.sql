-- Add assessment waiver fields to ClientAdvisorAssignment
-- Allows advisors to skip the assessment phase and go directly to reporting after intake

ALTER TABLE "ClientAdvisorAssignment" ADD COLUMN "assessmentWaivedAt" TIMESTAMP(3);
ALTER TABLE "ClientAdvisorAssignment" ADD COLUMN "assessmentWaivedByAdvisorId" TEXT;

-- Add foreign key constraint for assessmentWaivedByAdvisorId
ALTER TABLE "ClientAdvisorAssignment" ADD CONSTRAINT "ClientAdvisorAssignment_assessmentWaivedByAdvisorId_fkey" FOREIGN KEY ("assessmentWaivedByAdvisorId") REFERENCES "AdvisorProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

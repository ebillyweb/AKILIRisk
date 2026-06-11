-- Epic 5.11: assessment scope for intake-waived clients (no IntakeApproval row).
ALTER TABLE "ClientAdvisorAssignment"
ADD COLUMN "included_pillars" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "focus_areas" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

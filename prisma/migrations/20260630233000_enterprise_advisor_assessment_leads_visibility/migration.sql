-- Enterprise team setting: show Assessment leads to ADVISOR-role members.
ALTER TABLE "AdvisorEnterprise"
  ADD COLUMN "advisorMemberAssessmentLeadsVisible" BOOLEAN NOT NULL DEFAULT true;

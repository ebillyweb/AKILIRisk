-- Enterprise team setting: show Assessment leads to ADVISOR-role members.
ALTER TABLE "advisor_enterprises"
  ADD COLUMN "advisorMemberAssessmentLeadsVisible" BOOLEAN NOT NULL DEFAULT true;

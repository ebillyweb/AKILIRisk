-- Enterprise firm controls for what ADVISOR-role team members see in the workspace.
ALTER TABLE "AdvisorEnterprise"
  ADD COLUMN "advisorMemberPortfolioVisible" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "advisorMemberMethodologyVisible" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "advisorMemberEngagementsVisible" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "advisorMemberReassessmentVisible" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "advisorMemberProductToursVisible" BOOLEAN NOT NULL DEFAULT true;

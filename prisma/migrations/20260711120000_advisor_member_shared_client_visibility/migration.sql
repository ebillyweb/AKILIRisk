-- When true, ADVISOR-role team members see every client in the firm, not only their own assignments.
ALTER TABLE "AdvisorEnterprise"
  ADD COLUMN IF NOT EXISTS "advisorMemberSharedClientVisibilityEnabled" BOOLEAN NOT NULL DEFAULT false;

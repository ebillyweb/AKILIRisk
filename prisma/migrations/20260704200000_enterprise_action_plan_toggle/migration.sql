-- Firm-level toggle: show Strategic Action Plan in client portal and advisor guidance workflows.
ALTER TABLE "AdvisorEnterprise"
  ADD COLUMN "advisorMemberActionPlanEnabled" BOOLEAN NOT NULL DEFAULT true;

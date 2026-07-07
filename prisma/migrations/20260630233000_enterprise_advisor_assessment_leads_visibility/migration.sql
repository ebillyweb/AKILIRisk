-- Enterprise team setting: show Assessment leads to ADVISOR-role members.
-- Idempotent for partial Neon replays (see npm run db:fix-enterprise-assessment-leads-migration).
ALTER TABLE "AdvisorEnterprise"
  ADD COLUMN IF NOT EXISTS "advisorMemberAssessmentLeadsVisible" BOOLEAN NOT NULL DEFAULT true;

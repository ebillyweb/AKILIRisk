-- Epic 5.3 / US-48–US-49: per-member advisor sharing + tenant-wide
-- household profiles toggle (BRD §3.5 FR-HH-03 / FR-HH-04).

ALTER TABLE "HouseholdMember"
  ADD COLUMN IF NOT EXISTS "shareWithAdvisor" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "AdvisorProfile"
  ADD COLUMN IF NOT EXISTS "householdProfilesEnabled" BOOLEAN NOT NULL DEFAULT true;

-- Drop fields no longer collected on the public assessment request form.
ALTER TABLE "GovernanceReviewLead" DROP COLUMN IF EXISTS "familyOfficeName";
ALTER TABLE "GovernanceReviewLead" DROP COLUMN IF EXISTS "primaryAdvisor";

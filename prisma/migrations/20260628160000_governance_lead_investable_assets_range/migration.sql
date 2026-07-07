-- Optional investable assets band for public assessment request leads.
CREATE TYPE "InvestableAssetsRange" AS ENUM (
  'UNDER_5M',
  'FROM_5M_TO_25M',
  'FROM_25M_TO_100M',
  'OVER_100M',
  'PREFER_NOT_TO_SAY'
);

ALTER TABLE "GovernanceReviewLead"
ADD COLUMN "investableAssetsRange" "InvestableAssetsRange";

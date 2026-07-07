-- Remove ENTERPRISE from SubscriptionTier (enterprise is provisioning, not a module tier).
-- Pre-production: rewrite any ENTERPRISE subscription rows to PROFESSIONAL before enum swap.

UPDATE "Subscription"
SET tier = 'PROFESSIONAL'
WHERE tier = 'ENTERPRISE';

UPDATE "SubscriptionAuditLog"
SET "previousTier" = 'PROFESSIONAL'
WHERE "previousTier" = 'ENTERPRISE';

UPDATE "SubscriptionAuditLog"
SET "newTier" = 'PROFESSIONAL'
WHERE "newTier" = 'ENTERPRISE';

CREATE TYPE "SubscriptionTier_new" AS ENUM ('ESSENTIALS', 'PROFESSIONAL', 'BUSINESS', 'PLATINUM');

ALTER TABLE "Subscription"
  ALTER COLUMN tier TYPE "SubscriptionTier_new"
  USING tier::text::"SubscriptionTier_new";

ALTER TABLE "SubscriptionAuditLog"
  ALTER COLUMN "previousTier" TYPE "SubscriptionTier_new"
  USING "previousTier"::text::"SubscriptionTier_new";

ALTER TABLE "SubscriptionAuditLog"
  ALTER COLUMN "newTier" TYPE "SubscriptionTier_new"
  USING "newTier"::text::"SubscriptionTier_new";

DROP TYPE "SubscriptionTier";

ALTER TYPE "SubscriptionTier_new" RENAME TO "SubscriptionTier";

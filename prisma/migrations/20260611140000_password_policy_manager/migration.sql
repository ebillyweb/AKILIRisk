-- Password policy (super-admin managed) and per-user compliance tracking.
ALTER TABLE "PlatformSettings"
  ADD COLUMN "passwordMinLength" INTEGER NOT NULL DEFAULT 8,
  ADD COLUMN "passwordRequireUppercase" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "passwordRequireNumber" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "passwordPolicyRevision" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "passwordComplianceNotice" TEXT;

ALTER TABLE "User"
  ADD COLUMN "passwordChangeRequired" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "passwordPolicyRevision" INTEGER NOT NULL DEFAULT 0;

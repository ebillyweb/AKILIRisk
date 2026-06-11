-- Platform-wide MFA requirement toggle for client accounts (staff always require MFA in app logic).
ALTER TABLE "PlatformSettings" ADD COLUMN "mfaRequiredForAllRoles" BOOLEAN NOT NULL DEFAULT false;

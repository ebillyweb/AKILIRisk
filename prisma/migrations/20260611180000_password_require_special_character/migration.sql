-- Optional special-character requirement for platform password policy.
ALTER TABLE "PlatformSettings"
  ADD COLUMN "passwordRequireSpecialCharacter" BOOLEAN NOT NULL DEFAULT false;

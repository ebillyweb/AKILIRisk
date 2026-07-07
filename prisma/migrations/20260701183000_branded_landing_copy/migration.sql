-- Branded tenant landing page copy (headline, subhead, kicker) for advisor + enterprise branding.
ALTER TABLE "AdvisorEnterprise" ADD COLUMN IF NOT EXISTS "landingKicker" TEXT;
ALTER TABLE "AdvisorEnterprise" ADD COLUMN IF NOT EXISTS "landingHeadline" TEXT;
ALTER TABLE "AdvisorEnterprise" ADD COLUMN IF NOT EXISTS "landingSubheadline" TEXT;
ALTER TABLE "AdvisorEnterprise" ADD COLUMN IF NOT EXISTS "landingSubtext" TEXT;

ALTER TABLE "AdvisorProfile" ADD COLUMN IF NOT EXISTS "landingKicker" TEXT;
ALTER TABLE "AdvisorProfile" ADD COLUMN IF NOT EXISTS "landingHeadline" TEXT;
ALTER TABLE "AdvisorProfile" ADD COLUMN IF NOT EXISTS "landingSubheadline" TEXT;
ALTER TABLE "AdvisorProfile" ADD COLUMN IF NOT EXISTS "landingSubtext" TEXT;

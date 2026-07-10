-- Editable portal feature cards (title/description/visibility) for advisor + enterprise branding.
ALTER TABLE "AdvisorEnterprise" ADD COLUMN IF NOT EXISTS "landingFeatureCards" JSONB;
ALTER TABLE "AdvisorProfile" ADD COLUMN IF NOT EXISTS "landingFeatureCards" JSONB;

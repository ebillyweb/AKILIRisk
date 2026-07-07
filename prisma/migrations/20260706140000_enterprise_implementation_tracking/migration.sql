-- Enterprise feature flag for client engagement / implementation tracking (Phase 23).
ALTER TABLE "AdvisorEnterprise"
  ADD COLUMN IF NOT EXISTS "implementationTrackingEnabled" BOOLEAN NOT NULL DEFAULT true;

-- Advisor/admin queued pillar recommended actions for risk profile draft & report.
ALTER TABLE "Report" ADD COLUMN IF NOT EXISTS "queuedPillarActions" JSONB;

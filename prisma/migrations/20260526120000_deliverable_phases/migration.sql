-- BRD §6.3 / Epic 5.10: Deliverable phases foundation.
-- Adds the PREVIEW / PROFILE / PORTFOLIO state machine, the Key Risk
-- Indicator flag, and the PortfolioEngagement record created when a
-- client accepts the recommendation on their RISK PROFILE.

-- 1. New enums.
CREATE TYPE "DeliverablePhase" AS ENUM ('PREVIEW', 'PROFILE', 'PORTFOLIO');

CREATE TYPE "PortfolioEngagementStatus" AS ENUM (
  'ACCEPTED',
  'MEETING_SCHEDULED',
  'IN_PROGRESS',
  'COMPLETE',
  'DECLINED'
);

-- 2. Extend Assessment with the phase state machine.
ALTER TABLE "Assessment"
  ADD COLUMN "deliverablePhase"    "DeliverablePhase" NOT NULL DEFAULT 'PREVIEW',
  ADD COLUMN "previewEnteredAt"    TIMESTAMP(3),
  ADD COLUMN "profileEnteredAt"    TIMESTAMP(3),
  ADD COLUMN "portfolioEnteredAt"  TIMESTAMP(3),
  ADD COLUMN "upsellTriggersFired" JSONB;

CREATE INDEX "Assessment_deliverablePhase_idx"
  ON "Assessment" ("deliverablePhase");

-- 3. Backfill: any assessment already COMPLETED is in PREVIEW unless its
--    Report has a Published row, in which case it's in PROFILE.
UPDATE "Assessment"
SET "deliverablePhase"  = 'PREVIEW',
    "previewEnteredAt"  = COALESCE("completedAt", "updatedAt")
WHERE "status" = 'COMPLETED';

UPDATE "Assessment" a
SET "deliverablePhase"  = 'PROFILE',
    "profileEnteredAt"  = (
      SELECT MIN(r."publishedAt")
      FROM "Report" r
      WHERE r."assessmentId" = a."id"
        AND r."status" = 'PUBLISHED'
    )
WHERE EXISTS (
  SELECT 1 FROM "Report" r
  WHERE r."assessmentId" = a."id"
    AND r."status" = 'PUBLISHED'
);

-- 4. Flag Key Risk Indicators on the question bank.
ALTER TABLE "questions"
  ADD COLUMN "is_key_risk_indicator" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "questions_is_key_risk_indicator_idx"
  ON "questions" ("is_key_risk_indicator");

-- 5. PortfolioEngagement model.
CREATE TABLE "PortfolioEngagement" (
  "id"                 TEXT NOT NULL,
  "assessmentId"       TEXT NOT NULL,
  "clientId"           TEXT NOT NULL,
  "advisorId"          TEXT NOT NULL,
  "status"             "PortfolioEngagementStatus" NOT NULL DEFAULT 'ACCEPTED',
  "acceptedAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "meetingScheduledAt" TIMESTAMP(3),
  "meetingAt"          TIMESTAMP(3),
  "completedAt"        TIMESTAMP(3),
  "declinedAt"         TIMESTAMP(3),
  "notes"              TEXT,
  "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"          TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PortfolioEngagement_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PortfolioEngagement_assessmentId_key"
  ON "PortfolioEngagement" ("assessmentId");
CREATE INDEX "PortfolioEngagement_clientId_idx"
  ON "PortfolioEngagement" ("clientId");
CREATE INDEX "PortfolioEngagement_advisorId_idx"
  ON "PortfolioEngagement" ("advisorId");
CREATE INDEX "PortfolioEngagement_status_idx"
  ON "PortfolioEngagement" ("status");

ALTER TABLE "PortfolioEngagement"
  ADD CONSTRAINT "PortfolioEngagement_assessmentId_fkey"
  FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PortfolioEngagement"
  ADD CONSTRAINT "PortfolioEngagement_clientId_fkey"
  FOREIGN KEY ("clientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PortfolioEngagement"
  ADD CONSTRAINT "PortfolioEngagement_advisorId_fkey"
  FOREIGN KEY ("advisorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateEnum
CREATE TYPE "SignalSource" AS ENUM ('INTERNAL_ASSESSMENT', 'INTERNAL_WORKFLOW');

-- CreateEnum
CREATE TYPE "SignalType" AS ENUM (
  'PILLAR_CRITICAL',
  'PILLAR_MODERATE',
  'SCORE_DECLINED',
  'UPSELL_TRIGGER',
  'ASSESSMENT_COMPLETED',
  'ASSESSMENT_RESCORED',
  'REPORT_PUBLISHED'
);

-- CreateTable
CREATE TABLE "AdvisorSignal" (
    "id" TEXT NOT NULL,
    "advisorId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "source" "SignalSource" NOT NULL DEFAULT 'INTERNAL_ASSESSMENT',
    "type" "SignalType" NOT NULL,
    "severity" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "payload" JSONB,
    "dedupeKey" TEXT NOT NULL,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdvisorSignal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AdvisorSignal_advisorId_dedupeKey_key" ON "AdvisorSignal"("advisorId", "dedupeKey");

-- CreateIndex
CREATE INDEX "AdvisorSignal_advisorId_createdAt_idx" ON "AdvisorSignal"("advisorId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "AdvisorSignal_advisorId_readAt_idx" ON "AdvisorSignal"("advisorId", "readAt");

-- CreateIndex
CREATE INDEX "AdvisorSignal_clientId_idx" ON "AdvisorSignal"("clientId");

-- AddForeignKey
ALTER TABLE "AdvisorSignal" ADD CONSTRAINT "AdvisorSignal_advisorId_fkey" FOREIGN KEY ("advisorId") REFERENCES "AdvisorProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvisorSignal" ADD CONSTRAINT "AdvisorSignal_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

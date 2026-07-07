-- Phase 25: Executive Reporting - ExecutiveReport model
--
-- An ExecutiveReport is the advisor-published summary of a client's risk
-- posture across multiple assessments over a reporting window. It has the
-- same Draft -> Published -> Superseded lifecycle as the single-assessment
-- Report model (D-03), but is scoped to (clientId, advisorProfileId) rather
-- than a single assessmentId because executive reports span the full history
-- of client assessments (D-22, D-01).
--
-- Cascade rules (mirror Report model):
--   * client ON DELETE CASCADE -- RTBF on a client wipes every ExecutiveReport
--     row. executiveSnapshotData contains client PII and must not survive RTBF.
--   * advisorProfile ON DELETE CASCADE -- removing the advisor profile removes
--     their executive reports (no orphaned cross-client data).
--   * publishedBy ON DELETE SET NULL -- deleted advisor account does not orphan
--     published reports; the attribution becomes null rather than blocking deletion.
--
-- Partial unique index: only one DRAFT per (clientId, advisorProfileId) at any
-- time. Prisma DSL does not support partial unique indexes, so this lives here
-- as raw SQL (same pattern as Report_assessmentId_draft_unique in the reporting
-- engine migration 20260522120000_reporting_engine).

CREATE TABLE "ExecutiveReport" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "advisorProfileId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "status" "ReportStatus" NOT NULL DEFAULT 'DRAFT',
    "reportingPeriodStart" TIMESTAMP(3) NOT NULL,
    "reportingPeriodEnd" TIMESTAMP(3) NOT NULL,
    "executiveSnapshotData" JSONB,
    "brandingSnapshot" JSONB,
    "advisorNotes" TEXT,
    "meetingAgenda" TEXT,
    "discussionPrompts" JSONB,
    "publishedAt" TIMESTAMP(3),
    "publishedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExecutiveReport_pkey" PRIMARY KEY ("id")
);

-- Natural per-(client, advisor, version) uniqueness. Catches concurrent publish
-- races where two advisor sessions hit Publish at the same moment.
CREATE UNIQUE INDEX "ExecutiveReport_clientId_advisorProfileId_version_key"
    ON "ExecutiveReport"("clientId", "advisorProfileId", "version");

-- Composite covers "fetch DRAFT for this client+advisor" and "fetch PUBLISHED
-- history" at index speed. Mirrors Report_assessmentId_status_idx.
CREATE INDEX "ExecutiveReport_clientId_advisorProfileId_status_idx"
    ON "ExecutiveReport"("clientId", "advisorProfileId", "status");

-- Chronological listings (advisor dashboard; admin audit trail).
CREATE INDEX "ExecutiveReport_publishedAt_idx" ON "ExecutiveReport"("publishedAt");

-- Partial unique: one DRAFT per (clientId, advisorProfileId) at any time.
-- Postgres-only syntax -- Prisma does not support partial unique indexes in
-- the schema DSL (see migration 20260522120000_reporting_engine for the
-- original pattern). The concurrent publish race is surfaced as a Prisma P2002
-- constraint violation, which the publishExecutiveReport transaction catches.
CREATE UNIQUE INDEX "ExecutiveReport_clientId_advisorProfileId_draft_unique"
    ON "ExecutiveReport"("clientId", "advisorProfileId")
    WHERE "status" = 'DRAFT';

ALTER TABLE "ExecutiveReport" ADD CONSTRAINT "ExecutiveReport_clientId_fkey"
    FOREIGN KEY ("clientId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ExecutiveReport" ADD CONSTRAINT "ExecutiveReport_advisorProfileId_fkey"
    FOREIGN KEY ("advisorProfileId") REFERENCES "AdvisorProfile"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ExecutiveReport" ADD CONSTRAINT "ExecutiveReport_publishedById_fkey"
    FOREIGN KEY ("publishedById") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

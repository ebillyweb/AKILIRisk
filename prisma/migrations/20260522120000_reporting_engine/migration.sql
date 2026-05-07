-- §4.5 commit 3 (BRD §4.5) — Reporting Engine: Report model with publish/
-- snapshot/version semantics. A Report is the immutable advisor-published
-- rendering of an Assessment at a point in time. One DRAFT row per
-- assessment (open editing slot); zero or more PUBLISHED rows (history);
-- PUBLISHED transitions to SUPERSEDED when a newer DRAFT publishes.
--
-- Cascade rules:
--   * Report.assessment ON DELETE CASCADE — RTBF on a client wipes every
--     Report row for their assessments. Frozen reports include client PII
--     in snapshotData and must not survive RTBF.
--   * Report.publishedBy ON DELETE SET NULL — deleted advisor account
--     does not orphan published reports; the row stays, the publisher
--     attribution becomes null.
--
-- Partial unique index: only one DRAFT per assessment at any time. The
-- application-layer `getOrCreateDraft` does a findFirst → upsert dance,
-- which is racy under concurrent advisor edits. The partial unique index
-- catches the race at the DB and surfaces it as a Prisma constraint
-- violation, which the publishReport transaction retries once.

CREATE TYPE "ReportTemplate" AS ENUM ('BELVEDERE', 'COBRANDED');
CREATE TYPE "ReportStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'SUPERSEDED');

CREATE TABLE "Report" (
    "id" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "status" "ReportStatus" NOT NULL DEFAULT 'DRAFT',
    "templateChoice" "ReportTemplate" NOT NULL DEFAULT 'COBRANDED',
    "executiveSummary" TEXT,
    "advisorNotes" JSONB,
    "snapshotData" JSONB,
    "brandingSnapshot" JSONB,
    "publishedAt" TIMESTAMP(3),
    "publishedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

-- Natural per-assessment version uniqueness. Catches a v=N+1 collision
-- when two advisors hit Publish simultaneously (the loser's transaction
-- aborts and is retried).
CREATE UNIQUE INDEX "Report_assessmentId_version_key" ON "Report"("assessmentId", "version");

-- Composite covers both "fetch DRAFT for this assessment" and "fetch
-- latest PUBLISHED for this assessment" at index speed.
CREATE INDEX "Report_assessmentId_status_idx" ON "Report"("assessmentId", "status");

-- Chronological listings (admin compare-versions feed; ops dashboard).
CREATE INDEX "Report_publishedAt_idx" ON "Report"("publishedAt");

-- Partial unique: one DRAFT per assessment at any time. Postgres-only
-- syntax — Prisma does not yet (as of v5.x) support partial unique
-- indexes in the schema DSL, so this lives here as raw SQL.
-- §1 sign-off / approved.
CREATE UNIQUE INDEX "Report_assessmentId_draft_unique"
    ON "Report"("assessmentId")
    WHERE "status" = 'DRAFT';

ALTER TABLE "Report" ADD CONSTRAINT "Report_assessmentId_fkey"
    FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Report" ADD CONSTRAINT "Report_publishedById_fkey"
    FOREIGN KEY ("publishedById") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

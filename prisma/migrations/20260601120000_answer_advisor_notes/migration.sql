-- US-46c: per-advisor advisory notes on individual intake/assessment answers.
-- Sister tables to the US-46b admin notes. Tenant-isolation enforced at the
-- application layer (ClientAdvisorAssignment status=ACTIVE between calling
-- advisor and response's owning client). Composite unique on
-- (responseId, advisorId) so each advisor has at most one note per answer,
-- letting two different assigned advisors coexist on the same response.

CREATE TABLE "IntakeResponseAdvisorNote" (
    "id" TEXT NOT NULL,
    "intakeResponseId" TEXT NOT NULL,
    "advisorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "updatedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntakeResponseAdvisorNote_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AssessmentResponseAdvisorNote" (
    "id" TEXT NOT NULL,
    "assessmentResponseId" TEXT NOT NULL,
    "advisorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "updatedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssessmentResponseAdvisorNote_pkey" PRIMARY KEY ("id")
);

-- One note per (response, advisor) — the per-advisor scoping that distinguishes
-- this from the admin variant's single-note-per-response uniqueness.
CREATE UNIQUE INDEX "IntakeResponseAdvisorNote_intakeResponseId_advisorId_key"
    ON "IntakeResponseAdvisorNote"("intakeResponseId", "advisorId");
CREATE INDEX "IntakeResponseAdvisorNote_advisorId_idx"
    ON "IntakeResponseAdvisorNote"("advisorId");
CREATE INDEX "IntakeResponseAdvisorNote_createdByUserId_idx"
    ON "IntakeResponseAdvisorNote"("createdByUserId");

CREATE UNIQUE INDEX "AssessmentResponseAdvisorNote_assessmentResponseId_advisorId_key"
    ON "AssessmentResponseAdvisorNote"("assessmentResponseId", "advisorId");
CREATE INDEX "AssessmentResponseAdvisorNote_advisorId_idx"
    ON "AssessmentResponseAdvisorNote"("advisorId");
CREATE INDEX "AssessmentResponseAdvisorNote_createdByUserId_idx"
    ON "AssessmentResponseAdvisorNote"("createdByUserId");

ALTER TABLE "IntakeResponseAdvisorNote" ADD CONSTRAINT "IntakeResponseAdvisorNote_intakeResponseId_fkey"
    FOREIGN KEY ("intakeResponseId") REFERENCES "IntakeResponse"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "IntakeResponseAdvisorNote" ADD CONSTRAINT "IntakeResponseAdvisorNote_advisorId_fkey"
    FOREIGN KEY ("advisorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "IntakeResponseAdvisorNote" ADD CONSTRAINT "IntakeResponseAdvisorNote_createdByUserId_fkey"
    FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "IntakeResponseAdvisorNote" ADD CONSTRAINT "IntakeResponseAdvisorNote_updatedByUserId_fkey"
    FOREIGN KEY ("updatedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AssessmentResponseAdvisorNote" ADD CONSTRAINT "AssessmentResponseAdvisorNote_assessmentResponseId_fkey"
    FOREIGN KEY ("assessmentResponseId") REFERENCES "AssessmentResponse"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AssessmentResponseAdvisorNote" ADD CONSTRAINT "AssessmentResponseAdvisorNote_advisorId_fkey"
    FOREIGN KEY ("advisorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AssessmentResponseAdvisorNote" ADD CONSTRAINT "AssessmentResponseAdvisorNote_createdByUserId_fkey"
    FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AssessmentResponseAdvisorNote" ADD CONSTRAINT "AssessmentResponseAdvisorNote_updatedByUserId_fkey"
    FOREIGN KEY ("updatedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

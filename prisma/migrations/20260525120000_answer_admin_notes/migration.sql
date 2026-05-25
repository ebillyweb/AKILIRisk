-- US-46b: platform-admin advisory notes on individual intake/assessment answers.

CREATE TABLE "IntakeResponseAdminNote" (
    "id" TEXT NOT NULL,
    "intakeResponseId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "updatedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntakeResponseAdminNote_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AssessmentResponseAdminNote" (
    "id" TEXT NOT NULL,
    "assessmentResponseId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "updatedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssessmentResponseAdminNote_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "IntakeResponseAdminNote_intakeResponseId_key" ON "IntakeResponseAdminNote"("intakeResponseId");
CREATE INDEX "IntakeResponseAdminNote_createdByUserId_idx" ON "IntakeResponseAdminNote"("createdByUserId");

CREATE UNIQUE INDEX "AssessmentResponseAdminNote_assessmentResponseId_key" ON "AssessmentResponseAdminNote"("assessmentResponseId");
CREATE INDEX "AssessmentResponseAdminNote_createdByUserId_idx" ON "AssessmentResponseAdminNote"("createdByUserId");

ALTER TABLE "IntakeResponseAdminNote" ADD CONSTRAINT "IntakeResponseAdminNote_intakeResponseId_fkey" FOREIGN KEY ("intakeResponseId") REFERENCES "IntakeResponse"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "IntakeResponseAdminNote" ADD CONSTRAINT "IntakeResponseAdminNote_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "IntakeResponseAdminNote" ADD CONSTRAINT "IntakeResponseAdminNote_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AssessmentResponseAdminNote" ADD CONSTRAINT "AssessmentResponseAdminNote_assessmentResponseId_fkey" FOREIGN KEY ("assessmentResponseId") REFERENCES "AssessmentResponse"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AssessmentResponseAdminNote" ADD CONSTRAINT "AssessmentResponseAdminNote_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AssessmentResponseAdminNote" ADD CONSTRAINT "AssessmentResponseAdminNote_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

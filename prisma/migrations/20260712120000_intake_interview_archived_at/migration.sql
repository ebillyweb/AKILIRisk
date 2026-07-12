-- Archive prior intake interviews when an advisor restarts intake for a client.
ALTER TABLE "IntakeInterview" ADD COLUMN "archived_at" TIMESTAMP(3);

CREATE INDEX "IntakeInterview_archived_at_idx" ON "IntakeInterview"("archived_at");

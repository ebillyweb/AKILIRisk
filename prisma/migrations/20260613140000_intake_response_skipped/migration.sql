-- Advisor-facilitated intake: allow skipping questions during live sessions
ALTER TABLE "IntakeResponse" ADD COLUMN "skipped" BOOLEAN NOT NULL DEFAULT false;

-- Add typed-answer support to intake responses (mobile Type mode).
ALTER TABLE "IntakeResponse" ADD COLUMN "textResponse" TEXT;

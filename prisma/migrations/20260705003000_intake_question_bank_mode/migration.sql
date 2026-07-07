-- Intake question bank is either platform or custom — not both at runtime.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'IntakeQuestionBankMode') THEN
    CREATE TYPE "IntakeQuestionBankMode" AS ENUM ('PLATFORM', 'CUSTOM');
  END IF;
END $$;

ALTER TABLE "AdvisorEnterprise"
  ADD COLUMN IF NOT EXISTS "intake_question_bank_mode" "IntakeQuestionBankMode" NOT NULL DEFAULT 'PLATFORM';

ALTER TABLE "AdvisorProfile"
  ADD COLUMN IF NOT EXISTS "intake_question_bank_mode" "IntakeQuestionBankMode" NOT NULL DEFAULT 'PLATFORM';

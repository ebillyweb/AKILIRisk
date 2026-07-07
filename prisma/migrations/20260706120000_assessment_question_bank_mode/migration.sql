-- Per-practice assessment question bank: platform catalog or custom questions only.
-- Idempotent for partial Neon replays (see npm run db:fix-assessment-question-bank-mode-migration).
ALTER TABLE "AdvisorProfile"
  ADD COLUMN IF NOT EXISTS "assessment_question_bank_mode" "IntakeQuestionBankMode" NOT NULL DEFAULT 'PLATFORM';

ALTER TABLE "AdvisorEnterprise"
  ADD COLUMN IF NOT EXISTS "assessment_question_bank_mode" "IntakeQuestionBankMode" NOT NULL DEFAULT 'PLATFORM';

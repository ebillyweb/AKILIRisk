-- Custom assessment question answer labels (mirrors platform `questions` columns).
ALTER TABLE "advisor_pillar_questions"
  ADD COLUMN "answer_0" TEXT,
  ADD COLUMN "answer_1" TEXT,
  ADD COLUMN "answer_2" TEXT,
  ADD COLUMN "answer_3" TEXT;

ALTER TABLE "enterprise_pillar_questions"
  ADD COLUMN "answer_0" TEXT,
  ADD COLUMN "answer_1" TEXT,
  ADD COLUMN "answer_2" TEXT,
  ADD COLUMN "answer_3" TEXT;

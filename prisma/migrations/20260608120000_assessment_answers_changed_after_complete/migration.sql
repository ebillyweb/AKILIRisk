-- Track client answer edits after assessment completion (advisor re-score cue).
ALTER TABLE "Assessment" ADD COLUMN "answersChangedAfterCompleteAt" TIMESTAMP(3);

-- Lifecycle signal when completed-assessment answers change.
ALTER TYPE "SignalType" ADD VALUE IF NOT EXISTS 'ASSESSMENT_ANSWERS_CHANGED';

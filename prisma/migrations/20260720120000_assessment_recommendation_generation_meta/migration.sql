-- Phase 3 (LLM narratives): audit metadata for AI-drafted recommendation copy.
-- Nullable + no default, so existing rows are unaffected and the column is a
-- no-op until narrative generation is enabled.
ALTER TABLE "AssessmentRecommendation" ADD COLUMN IF NOT EXISTS "generation_meta" JSONB;

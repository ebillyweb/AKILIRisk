-- Platform base recommendation rules (edit/hide only) vs advisor-owned custom rules.
ALTER TABLE "advisor_recommendation_rules"
  ADD COLUMN "source_kind" "AdvisorQuestionSource" NOT NULL DEFAULT 'PLATFORM',
  ADD COLUMN "platform_source_id" TEXT;

ALTER TABLE "advisor_recommendation_rules"
  ADD CONSTRAINT "advisor_recommendation_rules_platform_source_id_fkey"
  FOREIGN KEY ("platform_source_id") REFERENCES "RecommendationRule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE UNIQUE INDEX "advisor_recommendation_rules_profile_platform_source_key"
  ON "advisor_recommendation_rules" ("advisor_profile_id", "platform_source_id")
  WHERE "platform_source_id" IS NOT NULL;

CREATE INDEX "advisor_recommendation_rules_advisor_profile_id_source_kind_idx"
  ON "advisor_recommendation_rules" ("advisor_profile_id", "source_kind");

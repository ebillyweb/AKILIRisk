-- AlterEnum: add ENTERPRISE to AdvisorQuestionSource
ALTER TYPE "AdvisorQuestionSource" ADD VALUE IF NOT EXISTS 'ENTERPRISE';

-- CreateTable: enterprise_recommendation_rules
CREATE TABLE "enterprise_recommendation_rules" (
    "id" TEXT NOT NULL,
    "enterprise_id" TEXT NOT NULL,
    "pillar_id" UUID,
    "source_kind" "AdvisorQuestionSource" NOT NULL DEFAULT 'PLATFORM',
    "platform_source_id" TEXT,
    "name" VARCHAR(200) NOT NULL,
    "trigger_conditions" JSONB NOT NULL,
    "service_payload" JSONB NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 1,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "enterprise_recommendation_rules_pkey" PRIMARY KEY ("id")
);

-- AddColumn: enterprise_source_id on advisor_recommendation_rules
ALTER TABLE "advisor_recommendation_rules" ADD COLUMN "enterprise_source_id" TEXT;

-- CreateIndex
CREATE INDEX "enterprise_recommendation_rules_enterprise_id_idx" ON "enterprise_recommendation_rules"("enterprise_id");
CREATE INDEX "enterprise_recommendation_rules_enterprise_id_is_active_idx" ON "enterprise_recommendation_rules"("enterprise_id", "is_active");
CREATE INDEX "enterprise_recommendation_rules_enterprise_id_source_kind_idx" ON "enterprise_recommendation_rules"("enterprise_id", "source_kind");
CREATE INDEX "advisor_recommendation_rules_enterprise_source_id_idx" ON "advisor_recommendation_rules"("enterprise_source_id");

-- AddForeignKey
ALTER TABLE "enterprise_recommendation_rules" ADD CONSTRAINT "enterprise_recommendation_rules_enterprise_id_fkey" FOREIGN KEY ("enterprise_id") REFERENCES "AdvisorEnterprise"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "enterprise_recommendation_rules" ADD CONSTRAINT "enterprise_recommendation_rules_pillar_id_fkey" FOREIGN KEY ("pillar_id") REFERENCES "pillars"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "enterprise_recommendation_rules" ADD CONSTRAINT "enterprise_recommendation_rules_platform_source_id_fkey" FOREIGN KEY ("platform_source_id") REFERENCES "RecommendationRule"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "advisor_recommendation_rules" ADD CONSTRAINT "advisor_recommendation_rules_enterprise_source_id_fkey" FOREIGN KEY ("enterprise_source_id") REFERENCES "enterprise_recommendation_rules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

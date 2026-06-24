-- AlterTable
ALTER TABLE "AdvisorProfile" ADD COLUMN     "catalog_version_seen" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "starter_content_cloned_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Assessment" ADD COLUMN     "snapshot_id" TEXT;

-- CreateTable
CREATE TABLE "pillars" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "slug" VARCHAR(80) NOT NULL,
    "canonical_name" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "default_order" INTEGER NOT NULL DEFAULT 0,
    "catalog_version" INTEGER NOT NULL DEFAULT 1,
    "archived_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pillars_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "advisor_pillar_overrides" (
    "id" TEXT NOT NULL,
    "advisor_profile_id" TEXT NOT NULL,
    "pillar_id" UUID NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "display_name" VARCHAR(200),
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 10,
    "threshold" JSONB NOT NULL,
    "section_weights" JSONB,
    "emphasis_multiplier" DOUBLE PRECISION NOT NULL DEFAULT 1.5,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "advisor_pillar_overrides_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "advisor_pillar_questions" (
    "id" TEXT NOT NULL,
    "advisor_profile_id" TEXT NOT NULL,
    "pillar_id" UUID NOT NULL,
    "section_code" VARCHAR(20) NOT NULL DEFAULT '',
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "question_number" VARCHAR(20),
    "question_text" TEXT NOT NULL,
    "answer_type" VARCHAR(50) NOT NULL DEFAULT 'scored_0_3',
    "score_map" JSONB NOT NULL,
    "why_this_matters" TEXT,
    "recommended_actions" TEXT,
    "is_visible" BOOLEAN NOT NULL DEFAULT true,
    "is_key_risk_indicator" BOOLEAN NOT NULL DEFAULT false,
    "related_pillar_ids" UUID[] DEFAULT ARRAY[]::UUID[],
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "advisor_pillar_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "advisor_intake_questions" (
    "id" TEXT NOT NULL,
    "advisor_profile_id" TEXT NOT NULL,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "question_number" VARCHAR(20),
    "question_text" TEXT NOT NULL,
    "context" TEXT,
    "help_text" TEXT,
    "learn_more" TEXT,
    "answer_type" VARCHAR(50) NOT NULL DEFAULT 'audio',
    "options" JSONB,
    "related_pillar_ids" UUID[] DEFAULT ARRAY[]::UUID[],
    "recommended_actions" TEXT,
    "is_visible" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "advisor_intake_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "advisor_pillar_narratives" (
    "id" TEXT NOT NULL,
    "advisor_profile_id" TEXT NOT NULL,
    "pillar_id" UUID NOT NULL,
    "all_negative" JSONB NOT NULL,
    "all_yes" JSONB NOT NULL,
    "mid_band" JSONB NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "advisor_pillar_narratives_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "advisor_recommendation_rules" (
    "id" TEXT NOT NULL,
    "advisor_profile_id" TEXT NOT NULL,
    "pillar_id" UUID,
    "name" VARCHAR(200) NOT NULL,
    "trigger_conditions" JSONB NOT NULL,
    "service_payload" JSONB NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 1,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "advisor_recommendation_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "intake_snapshots" (
    "id" TEXT NOT NULL,
    "intake_interview_id" TEXT NOT NULL,
    "advisor_profile_id" TEXT NOT NULL,
    "snapshot_blob" JSONB NOT NULL,
    "snapshot_hash" VARCHAR(64) NOT NULL,
    "schema_version" INTEGER NOT NULL DEFAULT 2,
    "taken_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "intake_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "pillars_slug_key" ON "pillars"("slug");

-- CreateIndex
CREATE INDEX "pillars_default_order_idx" ON "pillars"("default_order");

-- CreateIndex
CREATE INDEX "pillars_archived_at_idx" ON "pillars"("archived_at");

-- CreateIndex
CREATE INDEX "advisor_pillar_overrides_advisor_profile_id_idx" ON "advisor_pillar_overrides"("advisor_profile_id");

-- CreateIndex
CREATE INDEX "advisor_pillar_overrides_pillar_id_idx" ON "advisor_pillar_overrides"("pillar_id");

-- CreateIndex
CREATE UNIQUE INDEX "advisor_pillar_overrides_advisor_profile_id_pillar_id_key" ON "advisor_pillar_overrides"("advisor_profile_id", "pillar_id");

-- CreateIndex
CREATE INDEX "advisor_pillar_questions_advisor_profile_id_pillar_id_idx" ON "advisor_pillar_questions"("advisor_profile_id", "pillar_id");

-- CreateIndex
CREATE INDEX "advisor_pillar_questions_advisor_profile_id_idx" ON "advisor_pillar_questions"("advisor_profile_id");

-- CreateIndex
CREATE INDEX "advisor_intake_questions_advisor_profile_id_display_order_idx" ON "advisor_intake_questions"("advisor_profile_id", "display_order");

-- CreateIndex
CREATE INDEX "advisor_pillar_narratives_advisor_profile_id_idx" ON "advisor_pillar_narratives"("advisor_profile_id");

-- CreateIndex
CREATE UNIQUE INDEX "advisor_pillar_narratives_advisor_profile_id_pillar_id_key" ON "advisor_pillar_narratives"("advisor_profile_id", "pillar_id");

-- CreateIndex
CREATE INDEX "advisor_recommendation_rules_advisor_profile_id_idx" ON "advisor_recommendation_rules"("advisor_profile_id");

-- CreateIndex
CREATE INDEX "advisor_recommendation_rules_advisor_profile_id_is_active_idx" ON "advisor_recommendation_rules"("advisor_profile_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "intake_snapshots_intake_interview_id_key" ON "intake_snapshots"("intake_interview_id");

-- CreateIndex
CREATE INDEX "intake_snapshots_advisor_profile_id_idx" ON "intake_snapshots"("advisor_profile_id");

-- CreateIndex
CREATE INDEX "intake_snapshots_taken_at_idx" ON "intake_snapshots"("taken_at");

-- CreateIndex
CREATE INDEX "Assessment_snapshot_id_idx" ON "Assessment"("snapshot_id");

-- CreateIndex
CREATE INDEX "EnterpriseMembership_advisorProfileId_idx" ON "EnterpriseMembership"("advisorProfileId");

-- AddForeignKey
ALTER TABLE "Assessment" ADD CONSTRAINT "Assessment_snapshot_id_fkey" FOREIGN KEY ("snapshot_id") REFERENCES "intake_snapshots"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "advisor_pillar_overrides" ADD CONSTRAINT "advisor_pillar_overrides_advisor_profile_id_fkey" FOREIGN KEY ("advisor_profile_id") REFERENCES "AdvisorProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "advisor_pillar_overrides" ADD CONSTRAINT "advisor_pillar_overrides_pillar_id_fkey" FOREIGN KEY ("pillar_id") REFERENCES "pillars"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "advisor_pillar_questions" ADD CONSTRAINT "advisor_pillar_questions_advisor_profile_id_fkey" FOREIGN KEY ("advisor_profile_id") REFERENCES "AdvisorProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "advisor_pillar_questions" ADD CONSTRAINT "advisor_pillar_questions_pillar_id_fkey" FOREIGN KEY ("pillar_id") REFERENCES "pillars"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "advisor_intake_questions" ADD CONSTRAINT "advisor_intake_questions_advisor_profile_id_fkey" FOREIGN KEY ("advisor_profile_id") REFERENCES "AdvisorProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "advisor_pillar_narratives" ADD CONSTRAINT "advisor_pillar_narratives_advisor_profile_id_fkey" FOREIGN KEY ("advisor_profile_id") REFERENCES "AdvisorProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "advisor_pillar_narratives" ADD CONSTRAINT "advisor_pillar_narratives_pillar_id_fkey" FOREIGN KEY ("pillar_id") REFERENCES "pillars"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "advisor_recommendation_rules" ADD CONSTRAINT "advisor_recommendation_rules_advisor_profile_id_fkey" FOREIGN KEY ("advisor_profile_id") REFERENCES "AdvisorProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "advisor_recommendation_rules" ADD CONSTRAINT "advisor_recommendation_rules_pillar_id_fkey" FOREIGN KEY ("pillar_id") REFERENCES "pillars"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intake_snapshots" ADD CONSTRAINT "intake_snapshots_intake_interview_id_fkey" FOREIGN KEY ("intake_interview_id") REFERENCES "IntakeInterview"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intake_snapshots" ADD CONSTRAINT "intake_snapshots_advisor_profile_id_fkey" FOREIGN KEY ("advisor_profile_id") REFERENCES "AdvisorProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "AssessmentResponseAdvisorNote_assessmentResponseId_advisorId_ke" RENAME TO "AssessmentResponseAdvisorNote_assessmentResponseId_advisorI_key";

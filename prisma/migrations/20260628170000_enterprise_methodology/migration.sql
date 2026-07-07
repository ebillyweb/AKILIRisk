-- Enterprise methodology layer (platform → enterprise → advisor)

ALTER TABLE "advisor_pillar_overrides" ADD COLUMN "enterprise_source_id" TEXT;
ALTER TABLE "advisor_pillar_questions" ADD COLUMN "enterprise_source_id" TEXT;
ALTER TABLE "advisor_intake_questions" ADD COLUMN "enterprise_source_id" TEXT;
ALTER TABLE "advisor_pillar_narratives" ADD COLUMN "enterprise_source_id" TEXT;

CREATE TABLE "enterprise_pillar_overrides" (
    "id" TEXT NOT NULL,
    "enterprise_id" TEXT NOT NULL,
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

    CONSTRAINT "enterprise_pillar_overrides_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "enterprise_pillar_questions" (
    "id" TEXT NOT NULL,
    "enterprise_id" TEXT NOT NULL,
    "pillar_id" UUID NOT NULL,
    "source_kind" "AdvisorQuestionSource" NOT NULL DEFAULT 'PLATFORM',
    "platform_source_id" UUID,
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

    CONSTRAINT "enterprise_pillar_questions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "enterprise_intake_questions" (
    "id" TEXT NOT NULL,
    "enterprise_id" TEXT NOT NULL,
    "source_kind" "AdvisorQuestionSource" NOT NULL DEFAULT 'PLATFORM',
    "platform_source_id" UUID,
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

    CONSTRAINT "enterprise_intake_questions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "enterprise_pillar_narratives" (
    "id" TEXT NOT NULL,
    "enterprise_id" TEXT NOT NULL,
    "pillar_id" UUID NOT NULL,
    "all_negative" JSONB NOT NULL,
    "all_yes" JSONB NOT NULL,
    "mid_band" JSONB NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "enterprise_pillar_narratives_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "enterprise_pillar_overrides_enterprise_id_pillar_id_key" ON "enterprise_pillar_overrides"("enterprise_id", "pillar_id");
CREATE INDEX "enterprise_pillar_overrides_enterprise_id_idx" ON "enterprise_pillar_overrides"("enterprise_id");
CREATE INDEX "enterprise_pillar_overrides_pillar_id_idx" ON "enterprise_pillar_overrides"("pillar_id");

CREATE INDEX "enterprise_pillar_questions_enterprise_id_pillar_id_idx" ON "enterprise_pillar_questions"("enterprise_id", "pillar_id");
CREATE INDEX "enterprise_pillar_questions_enterprise_id_idx" ON "enterprise_pillar_questions"("enterprise_id");
CREATE INDEX "enterprise_pillar_questions_enterprise_id_source_kind_idx" ON "enterprise_pillar_questions"("enterprise_id", "source_kind");
CREATE INDEX "enterprise_pillar_questions_platform_source_id_idx" ON "enterprise_pillar_questions"("platform_source_id");

CREATE INDEX "enterprise_intake_questions_enterprise_id_display_order_idx" ON "enterprise_intake_questions"("enterprise_id", "display_order");
CREATE INDEX "enterprise_intake_questions_enterprise_id_source_kind_idx" ON "enterprise_intake_questions"("enterprise_id", "source_kind");
CREATE INDEX "enterprise_intake_questions_platform_source_id_idx" ON "enterprise_intake_questions"("platform_source_id");

CREATE UNIQUE INDEX "enterprise_pillar_narratives_enterprise_id_pillar_id_key" ON "enterprise_pillar_narratives"("enterprise_id", "pillar_id");
CREATE INDEX "enterprise_pillar_narratives_enterprise_id_idx" ON "enterprise_pillar_narratives"("enterprise_id");

CREATE INDEX "advisor_pillar_overrides_enterprise_source_id_idx" ON "advisor_pillar_overrides"("enterprise_source_id");
CREATE INDEX "advisor_pillar_questions_enterprise_source_id_idx" ON "advisor_pillar_questions"("enterprise_source_id");
CREATE INDEX "advisor_intake_questions_enterprise_source_id_idx" ON "advisor_intake_questions"("enterprise_source_id");
CREATE INDEX "advisor_pillar_narratives_enterprise_source_id_idx" ON "advisor_pillar_narratives"("enterprise_source_id");

ALTER TABLE "enterprise_pillar_overrides" ADD CONSTRAINT "enterprise_pillar_overrides_enterprise_id_fkey" FOREIGN KEY ("enterprise_id") REFERENCES "AdvisorEnterprise"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "enterprise_pillar_overrides" ADD CONSTRAINT "enterprise_pillar_overrides_pillar_id_fkey" FOREIGN KEY ("pillar_id") REFERENCES "pillars"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "enterprise_pillar_questions" ADD CONSTRAINT "enterprise_pillar_questions_enterprise_id_fkey" FOREIGN KEY ("enterprise_id") REFERENCES "AdvisorEnterprise"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "enterprise_pillar_questions" ADD CONSTRAINT "enterprise_pillar_questions_pillar_id_fkey" FOREIGN KEY ("pillar_id") REFERENCES "pillars"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "enterprise_pillar_questions" ADD CONSTRAINT "enterprise_pillar_questions_platform_source_id_fkey" FOREIGN KEY ("platform_source_id") REFERENCES "questions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "enterprise_intake_questions" ADD CONSTRAINT "enterprise_intake_questions_enterprise_id_fkey" FOREIGN KEY ("enterprise_id") REFERENCES "AdvisorEnterprise"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "enterprise_intake_questions" ADD CONSTRAINT "enterprise_intake_questions_platform_source_id_fkey" FOREIGN KEY ("platform_source_id") REFERENCES "questions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "enterprise_pillar_narratives" ADD CONSTRAINT "enterprise_pillar_narratives_enterprise_id_fkey" FOREIGN KEY ("enterprise_id") REFERENCES "AdvisorEnterprise"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "enterprise_pillar_narratives" ADD CONSTRAINT "enterprise_pillar_narratives_pillar_id_fkey" FOREIGN KEY ("pillar_id") REFERENCES "pillars"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "advisor_pillar_overrides" ADD CONSTRAINT "advisor_pillar_overrides_enterprise_source_id_fkey" FOREIGN KEY ("enterprise_source_id") REFERENCES "enterprise_pillar_overrides"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "advisor_pillar_questions" ADD CONSTRAINT "advisor_pillar_questions_enterprise_source_id_fkey" FOREIGN KEY ("enterprise_source_id") REFERENCES "enterprise_pillar_questions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "advisor_intake_questions" ADD CONSTRAINT "advisor_intake_questions_enterprise_source_id_fkey" FOREIGN KEY ("enterprise_source_id") REFERENCES "enterprise_intake_questions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "advisor_pillar_narratives" ADD CONSTRAINT "advisor_pillar_narratives_enterprise_source_id_fkey" FOREIGN KEY ("enterprise_source_id") REFERENCES "enterprise_pillar_narratives"("id") ON DELETE SET NULL ON UPDATE CASCADE;

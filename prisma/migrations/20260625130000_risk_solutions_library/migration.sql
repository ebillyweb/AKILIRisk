-- Risk Solutions Library: enrich ServiceRecommendation, extend AssessmentRecommendation,
-- add compose-at-read customization overlays, solution milestones, and activity log.

-- 1. Enrich ServiceRecommendation with solution catalog fields
ALTER TABLE "ServiceRecommendation" ADD COLUMN "slug" TEXT;
ALTER TABLE "ServiceRecommendation" ADD COLUMN "shortDescription" VARCHAR(280);
ALTER TABLE "ServiceRecommendation" ADD COLUMN "icon" VARCHAR(60);
ALTER TABLE "ServiceRecommendation" ADD COLUMN "expectedOutcome" TEXT;
ALTER TABLE "ServiceRecommendation" ADD COLUMN "tags" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "ServiceRecommendation" ADD COLUMN "playbook" JSONB;
ALTER TABLE "ServiceRecommendation" ADD COLUMN "externalUrl" TEXT;
ALTER TABLE "ServiceRecommendation" ADD COLUMN "prerequisites" TEXT[] DEFAULT ARRAY[]::TEXT[];

CREATE UNIQUE INDEX "ServiceRecommendation_slug_key" ON "ServiceRecommendation"("slug");

-- 2. Extend AssessmentRecommendation with lifecycle tracking
ALTER TABLE "AssessmentRecommendation" ADD COLUMN "statusUpdatedAt" TIMESTAMP(3);
ALTER TABLE "AssessmentRecommendation" ADD COLUMN "acceptedAt" TIMESTAMP(3);
ALTER TABLE "AssessmentRecommendation" ADD COLUMN "startedAt" TIMESTAMP(3);
ALTER TABLE "AssessmentRecommendation" ADD COLUMN "completedAt" TIMESTAMP(3);
ALTER TABLE "AssessmentRecommendation" ADD COLUMN "declinedAt" TIMESTAMP(3);
ALTER TABLE "AssessmentRecommendation" ADD COLUMN "declinedReason" TEXT;
ALTER TABLE "AssessmentRecommendation" ADD COLUMN "implementationNotes" TEXT;
ALTER TABLE "AssessmentRecommendation" ADD COLUMN "urgencyScore" DOUBLE PRECISION;
ALTER TABLE "AssessmentRecommendation" ADD COLUMN "projectedImpact" DOUBLE PRECISION;
ALTER TABLE "AssessmentRecommendation" ADD COLUMN "source_layer_summary" JSONB;

-- 3. Enterprise solution customization overlay
CREATE TABLE "enterprise_solution_customizations" (
    "id" TEXT NOT NULL,
    "enterprise_id" TEXT NOT NULL,
    "service_recommendation_id" TEXT NOT NULL,
    "cost_override" TEXT,
    "timeframe_override" TEXT,
    "provider_override" TEXT,
    "additional_playbook" JSONB,
    "notes" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "enterprise_solution_customizations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "enterprise_solution_customizations_enterprise_id_service_reco_key" ON "enterprise_solution_customizations"("enterprise_id", "service_recommendation_id");
CREATE INDEX "enterprise_solution_customizations_enterprise_id_idx" ON "enterprise_solution_customizations"("enterprise_id");

ALTER TABLE "enterprise_solution_customizations" ADD CONSTRAINT "enterprise_solution_customizations_enterprise_id_fkey" FOREIGN KEY ("enterprise_id") REFERENCES "AdvisorEnterprise"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "enterprise_solution_customizations" ADD CONSTRAINT "enterprise_solution_customizations_service_recommendation_id_fkey" FOREIGN KEY ("service_recommendation_id") REFERENCES "ServiceRecommendation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 4. Advisor solution customization overlay
CREATE TABLE "advisor_solution_customizations" (
    "id" TEXT NOT NULL,
    "advisor_profile_id" TEXT NOT NULL,
    "service_recommendation_id" TEXT NOT NULL,
    "cost_override" TEXT,
    "timeframe_override" TEXT,
    "provider_override" TEXT,
    "additional_playbook" JSONB,
    "notes" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "advisor_solution_customizations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "advisor_solution_customizations_advisor_profile_id_service_re_key" ON "advisor_solution_customizations"("advisor_profile_id", "service_recommendation_id");
CREATE INDEX "advisor_solution_customizations_advisor_profile_id_idx" ON "advisor_solution_customizations"("advisor_profile_id");

ALTER TABLE "advisor_solution_customizations" ADD CONSTRAINT "advisor_solution_customizations_advisor_profile_id_fkey" FOREIGN KEY ("advisor_profile_id") REFERENCES "AdvisorProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "advisor_solution_customizations" ADD CONSTRAINT "advisor_solution_customizations_service_recommendation_id_fkey" FOREIGN KEY ("service_recommendation_id") REFERENCES "ServiceRecommendation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 5. Milestone source and status enums
CREATE TYPE "MilestoneSource" AS ENUM ('PLATFORM', 'ENTERPRISE', 'ADVISOR');
CREATE TYPE "MilestoneStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'SKIPPED');

-- 6. Solution milestones (materialized playbook steps)
CREATE TABLE "solution_milestones" (
    "id" TEXT NOT NULL,
    "assessment_recommendation_id" TEXT NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "estimated_duration" VARCHAR(60),
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "source" "MilestoneSource" NOT NULL DEFAULT 'PLATFORM',
    "status" "MilestoneStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "solution_milestones_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "solution_milestones_assessment_recommendation_id_idx" ON "solution_milestones"("assessment_recommendation_id");
CREATE INDEX "solution_milestones_assessment_recommendation_id_sort_order_idx" ON "solution_milestones"("assessment_recommendation_id", "sort_order");

ALTER TABLE "solution_milestones" ADD CONSTRAINT "solution_milestones_assessment_recommendation_id_fkey" FOREIGN KEY ("assessment_recommendation_id") REFERENCES "AssessmentRecommendation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 7. Solution activity log (append-only)
CREATE TABLE "solution_activities" (
    "id" TEXT NOT NULL,
    "assessment_recommendation_id" TEXT NOT NULL,
    "actor_id" TEXT,
    "action" VARCHAR(60) NOT NULL,
    "detail" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "solution_activities_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "solution_activities_assessment_recommendation_id_idx" ON "solution_activities"("assessment_recommendation_id");
CREATE INDEX "solution_activities_assessment_recommendation_id_created_at_idx" ON "solution_activities"("assessment_recommendation_id", "created_at");

ALTER TABLE "solution_activities" ADD CONSTRAINT "solution_activities_assessment_recommendation_id_fkey" FOREIGN KEY ("assessment_recommendation_id") REFERENCES "AssessmentRecommendation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

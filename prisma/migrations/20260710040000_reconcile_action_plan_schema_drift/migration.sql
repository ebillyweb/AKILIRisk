-- Reconcile schema drift: action-plan / recommendation-workflow columns, enums,
-- and indexes that were added to schema.prisma (and synced to dev via
-- `prisma db push`) but never captured in a migration. Production only runs
-- `migrate deploy`, so these were missing there — breaking any query that
-- selects the affected tables (e.g. the advisor pipeline).
--
-- Authored idempotently (IF [NOT] EXISTS + guarded renames) so it applies
-- cleanly regardless of an environment's current state: prod (missing all),
-- preview/dev (may already have some via db push).

-- ── Enums (CREATE TYPE has no IF NOT EXISTS; guard each) ────────────────────
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TaskStatus') THEN
    CREATE TYPE "TaskStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'WAITING', 'READY_FOR_REVIEW', 'COMPLETED');
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ValidationStatus') THEN
    CREATE TYPE "ValidationStatus" AS ENUM ('PENDING_REVIEW', 'VERIFIED', 'NEEDS_FOLLOWUP');
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AdvisorPriority') THEN
    CREATE TYPE "AdvisorPriority" AS ENUM ('HIGH', 'MEDIUM', 'LOW');
  END IF;
END $$;

-- ── Enum value additions (IF NOT EXISTS supported on PostgreSQL 12+) ────────
ALTER TYPE "MilestoneStatus" ADD VALUE IF NOT EXISTS 'BLOCKED';
ALTER TYPE "MilestoneStatus" ADD VALUE IF NOT EXISTS 'DEFERRED';
ALTER TYPE "RecommendationStatus" ADD VALUE IF NOT EXISTS 'GENERATED';
ALTER TYPE "RecommendationStatus" ADD VALUE IF NOT EXISTS 'INCLUDED';
ALTER TYPE "RecommendationStatus" ADD VALUE IF NOT EXISTS 'DEFERRED';
ALTER TYPE "RecommendationStatus" ADD VALUE IF NOT EXISTS 'IN_PROGRESS';

-- ── Obsolete index ─────────────────────────────────────────────────────────
DROP INDEX IF EXISTS "ExecutiveReport_publishedAt_idx";

-- ── Columns ────────────────────────────────────────────────────────────────
ALTER TABLE "Assessment" ADD COLUMN IF NOT EXISTS "action_plan_published_at" TIMESTAMP(3);

ALTER TABLE "AssessmentRecommendation"
  ADD COLUMN IF NOT EXISTS "advisorPriority" "AdvisorPriority",
  ADD COLUMN IF NOT EXISTS "assignees" JSONB,
  ADD COLUMN IF NOT EXISTS "deferredReason" TEXT,
  ADD COLUMN IF NOT EXISTS "deferredRevisitDate" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "deferredTriggerEvent" TEXT,
  ADD COLUMN IF NOT EXISTS "hiddenFromClient" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "requiresValidation" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "responsibleRoles" TEXT[] DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS "taskStatus" "TaskStatus" NOT NULL DEFAULT 'NOT_STARTED',
  ADD COLUMN IF NOT EXISTS "timeHorizon" VARCHAR(20),
  ADD COLUMN IF NOT EXISTS "validationStatus" "ValidationStatus" NOT NULL DEFAULT 'PENDING_REVIEW';

ALTER TABLE "ServiceRecommendation" ADD COLUMN IF NOT EXISTS "overridePolicies" JSONB;

ALTER TABLE "enterprise_solution_customizations"
  ADD COLUMN IF NOT EXISTS "compliance_disclosures" TEXT,
  ADD COLUMN IF NOT EXISTS "custom_guidance" TEXT,
  ADD COLUMN IF NOT EXISTS "internal_links" JSONB,
  ADD COLUMN IF NOT EXISTS "is_required" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "priority_adjustment" INTEGER;

ALTER TABLE "solution_milestones"
  ADD COLUMN IF NOT EXISTS "blocked_reason" VARCHAR(500),
  ADD COLUMN IF NOT EXISTS "deferred_reason" VARCHAR(500),
  ADD COLUMN IF NOT EXISTS "deferred_revisit_date" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "due_date" TIMESTAMP(3);

-- ── Indexes ────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS "AssessmentRecommendation_taskStatus_hiddenFromClient_idx" ON "AssessmentRecommendation"("taskStatus", "hiddenFromClient");
CREATE INDEX IF NOT EXISTS "advisor_intake_questions_advisor_profile_id_source_kind_idx" ON "advisor_intake_questions"("advisor_profile_id", "source_kind");
CREATE INDEX IF NOT EXISTS "advisor_pillar_questions_advisor_profile_id_source_kind_idx" ON "advisor_pillar_questions"("advisor_profile_id", "source_kind");

-- ── Constraint / index renames (guarded: only when old exists and new does not) ──
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'enterprise_solution_customizations_service_recommendation_id_fk')
     AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'enterprise_solution_customizations_service_recommendation__fkey') THEN
    ALTER TABLE "enterprise_solution_customizations" RENAME CONSTRAINT "enterprise_solution_customizations_service_recommendation_id_fk" TO "enterprise_solution_customizations_service_recommendation__fkey";
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'advisor_solution_customizations_advisor_profile_id_service_re_k')
     AND NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'advisor_solution_customizations_advisor_profile_id_service__key') THEN
    ALTER INDEX "advisor_solution_customizations_advisor_profile_id_service_re_k" RENAME TO "advisor_solution_customizations_advisor_profile_id_service__key";
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'enterprise_solution_customizations_enterprise_id_service_reco_k')
     AND NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'enterprise_solution_customizations_enterprise_id_service_re_key') THEN
    ALTER INDEX "enterprise_solution_customizations_enterprise_id_service_reco_k" RENAME TO "enterprise_solution_customizations_enterprise_id_service_re_key";
  END IF;
END $$;

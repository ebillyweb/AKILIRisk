-- Advisor workflow nav toggles (Tasks, Follow-ups) — off until super admin enables.
ALTER TABLE "PlatformSettings"
ADD COLUMN "advisorWorkflowTasksEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "advisorWorkflowFollowUpsEnabled" BOOLEAN NOT NULL DEFAULT false;

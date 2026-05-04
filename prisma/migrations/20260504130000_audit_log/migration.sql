-- Round-7: BRD §5.4 + §3.1 audit logging.
-- Generic AuditLog table; existing SubscriptionAuditLog and AdvisorBrandingAuditLog
-- are intentionally left in place (typed columns / FK cascades respectively).
-- See src/lib/audit/audit-log.ts for the action vocabulary and write helper.

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorUserId" TEXT,
    "actorRole" "UserRole",
    "actorEmailHash" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "beforeData" JSONB,
    "afterData" JSONB,
    "metadata" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
-- Composite covers the common "show audit history for entity X" query plus the
-- "show actions on this entity newest-first" subquery without a sort step.
CREATE INDEX "AuditLog_entityType_entityId_createdAt_idx"
    ON "AuditLog"("entityType", "entityId", "createdAt");

-- CreateIndex
-- "What did this actor do, newest first?" — admin drill-down from /admin/advisors.
CREATE INDEX "AuditLog_actorUserId_createdAt_idx"
    ON "AuditLog"("actorUserId", "createdAt");

-- CreateIndex
-- "All instances of action X" — admin filter by action type.
CREATE INDEX "AuditLog_action_createdAt_idx"
    ON "AuditLog"("action", "createdAt");

-- CreateIndex
-- Retention cron's WHERE clause: createdAt < (now() - interval '<N> days').
CREATE INDEX "AuditLog_createdAt_idx"
    ON "AuditLog"("createdAt");

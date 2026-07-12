-- Pipeline monitoring chevron + post-report phase — off until super admin enables.
ALTER TABLE "PlatformSettings"
ADD COLUMN "advisorMonitoringEnabled" BOOLEAN NOT NULL DEFAULT false;

-- Super-admin test account flag: excludes USER/ADVISOR rows from platform KPI dashboards.
ALTER TABLE "User" ADD COLUMN "isTestAccount" BOOLEAN NOT NULL DEFAULT false;

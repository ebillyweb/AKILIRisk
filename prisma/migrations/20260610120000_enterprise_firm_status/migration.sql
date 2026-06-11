-- CreateEnum
CREATE TYPE "AdvisorEnterpriseStatus" AS ENUM ('ACTIVE', 'SUSPENDED');

-- AlterTable
ALTER TABLE "AdvisorEnterprise" ADD COLUMN "status" "AdvisorEnterpriseStatus" NOT NULL DEFAULT 'ACTIVE';

CREATE INDEX "AdvisorEnterprise_status_idx" ON "AdvisorEnterprise"("status");

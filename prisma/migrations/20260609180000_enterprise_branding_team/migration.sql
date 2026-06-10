-- Enterprise Phase 3: canonical firm branding + enterprise-owned subdomain link.

ALTER TABLE "AdvisorEnterprise" ADD COLUMN "brandName" TEXT;
ALTER TABLE "AdvisorEnterprise" ADD COLUMN "tagline" TEXT;
ALTER TABLE "AdvisorEnterprise" ADD COLUMN "primaryColor" TEXT;
ALTER TABLE "AdvisorEnterprise" ADD COLUMN "secondaryColor" TEXT;
ALTER TABLE "AdvisorEnterprise" ADD COLUMN "accentColor" TEXT;
ALTER TABLE "AdvisorEnterprise" ADD COLUMN "websiteUrl" TEXT;
ALTER TABLE "AdvisorEnterprise" ADD COLUMN "emailFooterText" TEXT;
ALTER TABLE "AdvisorEnterprise" ADD COLUMN "supportEmail" TEXT;
ALTER TABLE "AdvisorEnterprise" ADD COLUMN "supportPhone" TEXT;
ALTER TABLE "AdvisorEnterprise" ADD COLUMN "logoUrl" TEXT;
ALTER TABLE "AdvisorEnterprise" ADD COLUMN "logoS3Key" TEXT;
ALTER TABLE "AdvisorEnterprise" ADD COLUMN "logoContentType" TEXT;
ALTER TABLE "AdvisorEnterprise" ADD COLUMN "logoFileSize" INTEGER;
ALTER TABLE "AdvisorEnterprise" ADD COLUMN "logoUploadedAt" TIMESTAMP(3);
ALTER TABLE "AdvisorEnterprise" ADD COLUMN "brandingEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "AdvisorEnterprise" ADD COLUMN "customDomainEnabled" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "AdvisorSubdomain" ADD COLUMN "enterpriseId" TEXT;

CREATE UNIQUE INDEX "AdvisorSubdomain_enterpriseId_key" ON "AdvisorSubdomain"("enterpriseId");
CREATE INDEX "AdvisorSubdomain_enterpriseId_idx" ON "AdvisorSubdomain"("enterpriseId");

ALTER TABLE "AdvisorSubdomain" ADD CONSTRAINT "AdvisorSubdomain_enterpriseId_fkey" FOREIGN KEY ("enterpriseId") REFERENCES "AdvisorEnterprise"("id") ON DELETE SET NULL ON UPDATE CASCADE;

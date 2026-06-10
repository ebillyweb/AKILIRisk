-- Enterprise advisor plan (Phase 1): firm tenant, memberships, enterprise billing.

-- CreateEnum
CREATE TYPE "EnterpriseRole" AS ENUM ('OWNER', 'ADMIN', 'ADVISOR');

-- CreateEnum
CREATE TYPE "EnterpriseMembershipStatus" AS ENUM ('INVITED', 'ACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "EnterprisePaymentMethod" AS ENUM ('WIRE', 'CARD');

-- AlterEnum
ALTER TYPE "SubscriptionTier" ADD VALUE 'ENTERPRISE';

-- CreateTable
CREATE TABLE "AdvisorEnterprise" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "seatLimit" INTEGER NOT NULL,
    "clientLimit" INTEGER NOT NULL,
    "perAdvisorClientLimit" INTEGER NOT NULL,
    "paymentMethod" "EnterprisePaymentMethod" NOT NULL DEFAULT 'WIRE',
    "billingContactUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdvisorEnterprise_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EnterpriseMembership" (
    "id" TEXT NOT NULL,
    "enterpriseId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "advisorProfileId" TEXT,
    "role" "EnterpriseRole" NOT NULL,
    "status" "EnterpriseMembershipStatus" NOT NULL DEFAULT 'INVITED',
    "invitedEmail" TEXT,
    "invitedAt" TIMESTAMP(3),
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EnterpriseMembership_pkey" PRIMARY KEY ("id")
);

-- AlterTable: Subscription — solo (userId) OR enterprise (enterpriseId), never both.
ALTER TABLE "Subscription" ALTER COLUMN "userId" DROP NOT NULL;
ALTER TABLE "Subscription" ADD COLUMN "enterpriseId" TEXT;

-- AlterTable
ALTER TABLE "AdvisorProfile" ADD COLUMN "enterpriseId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "AdvisorEnterprise_slug_key" ON "AdvisorEnterprise"("slug");

-- CreateIndex
CREATE INDEX "AdvisorEnterprise_billingContactUserId_idx" ON "AdvisorEnterprise"("billingContactUserId");

-- CreateIndex
CREATE UNIQUE INDEX "EnterpriseMembership_userId_key" ON "EnterpriseMembership"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "EnterpriseMembership_advisorProfileId_key" ON "EnterpriseMembership"("advisorProfileId");

-- CreateIndex
CREATE INDEX "EnterpriseMembership_enterpriseId_idx" ON "EnterpriseMembership"("enterpriseId");

-- CreateIndex
CREATE INDEX "EnterpriseMembership_status_idx" ON "EnterpriseMembership"("status");

-- CreateIndex
CREATE UNIQUE INDEX "EnterpriseMembership_enterpriseId_userId_key" ON "EnterpriseMembership"("enterpriseId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_enterpriseId_key" ON "Subscription"("enterpriseId");

-- CreateIndex
CREATE INDEX "Subscription_enterpriseId_idx" ON "Subscription"("enterpriseId");

-- CreateIndex
CREATE INDEX "AdvisorProfile_enterpriseId_idx" ON "AdvisorProfile"("enterpriseId");

-- AddForeignKey
ALTER TABLE "AdvisorEnterprise" ADD CONSTRAINT "AdvisorEnterprise_billingContactUserId_fkey" FOREIGN KEY ("billingContactUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnterpriseMembership" ADD CONSTRAINT "EnterpriseMembership_enterpriseId_fkey" FOREIGN KEY ("enterpriseId") REFERENCES "AdvisorEnterprise"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnterpriseMembership" ADD CONSTRAINT "EnterpriseMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnterpriseMembership" ADD CONSTRAINT "EnterpriseMembership_advisorProfileId_fkey" FOREIGN KEY ("advisorProfileId") REFERENCES "AdvisorProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_enterpriseId_fkey" FOREIGN KEY ("enterpriseId") REFERENCES "AdvisorEnterprise"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvisorProfile" ADD CONSTRAINT "AdvisorProfile_enterpriseId_fkey" FOREIGN KEY ("enterpriseId") REFERENCES "AdvisorEnterprise"("id") ON DELETE SET NULL ON UPDATE CASCADE;

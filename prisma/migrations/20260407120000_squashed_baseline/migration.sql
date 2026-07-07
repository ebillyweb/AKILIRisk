-- Squashed baseline (replaces incremental migrations that could not replay on an empty shadow DB).
-- Root cause: `20240405000001_enhanced_advisor_branding` was ordered before `20250324120000_add_subscription_billing`,
-- so Prisma applied ALTERs to AdvisorProfile/Subscription before those tables existed.
--
-- Existing DBs that already match prisma/schema.prisma: delete obsolete rows from `_prisma_migrations` for removed
-- folders, then: npx prisma migrate resolve --applied 20260407120000_squashed_baseline

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'ADVISOR', 'ADMIN');

-- CreateEnum
CREATE TYPE "SubscriptionTier" AS ENUM ('ESSENTIALS', 'PROFESSIONAL', 'BUSINESS');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'PAST_DUE', 'CANCELLED', 'UNPAID', 'GRACE_PERIOD');

-- CreateEnum
CREATE TYPE "BillingCycle" AS ENUM ('MONTHLY', 'ANNUAL');

-- CreateEnum
CREATE TYPE "AssessmentStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "RiskLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "InvitationStatus" AS ENUM ('SENT', 'OPENED', 'REGISTERED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "ClientWorkflowStage" AS ENUM ('INVITED', 'REGISTERED', 'INTAKE_IN_PROGRESS', 'INTAKE_COMPLETE', 'ASSESSMENT_IN_PROGRESS', 'ASSESSMENT_COMPLETE', 'DOCUMENTS_REQUIRED', 'COMPLETE');

-- CreateEnum
CREATE TYPE "FamilyRelationship" AS ENUM ('SPOUSE', 'CHILD', 'PARENT', 'SIBLING', 'GRANDCHILD', 'GRANDPARENT', 'OTHER');

-- CreateEnum
CREATE TYPE "GovernanceRole" AS ENUM ('DECISION_MAKER', 'ADVISOR', 'SUCCESSOR', 'BENEFICIARY', 'TRUSTEE', 'EXECUTOR', 'OTHER');

-- CreateEnum
CREATE TYPE "IntakeStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'SUBMITTED');

-- CreateEnum
CREATE TYPE "TranscriptionStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "AssignmentStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('PENDING', 'IN_REVIEW', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('NEW_INTAKE', 'INTAKE_UPDATED', 'NEW_LEAD', 'SYSTEM', 'CLIENT_REGISTERED', 'MILESTONE_COMPLETE', 'WORKFLOW_STALLED', 'DOCUMENT_UPLOADED');

-- CreateEnum
CREATE TYPE "FamilyComplexity" AS ENUM ('SINGLE_HOUSEHOLD', 'MULTI_GENERATIONAL', 'FAMILY_BUSINESS_INVOLVED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" TIMESTAMP(3),
    "password" TEXT NOT NULL,
    "name" TEXT,
    "firstName" TEXT,
    "lastName" TEXT,
    "image" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "mfaEnabled" BOOLEAN NOT NULL DEFAULT false,
    "mfaSecret" TEXT,
    "mfaRecoveryCodes" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "stripeCustomerId" TEXT,
    "stripePriceId" TEXT,
    "stripeSubscriptionId" TEXT,
    "tier" "SubscriptionTier" NOT NULL,
    "status" "SubscriptionStatus" NOT NULL,
    "clientLimit" INTEGER NOT NULL,
    "billingCycle" "BillingCycle" NOT NULL,
    "currentPeriodEnd" TIMESTAMP(3) NOT NULL,
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "basicBrandingEnabled" BOOLEAN NOT NULL DEFAULT false,
    "advancedBrandingEnabled" BOOLEAN NOT NULL DEFAULT false,
    "customSubdomainEnabled" BOOLEAN NOT NULL DEFAULT false,
    "whiteLabel" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubscriptionAuditLog" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "previousTier" "SubscriptionTier",
    "newTier" "SubscriptionTier",
    "metadata" JSONB,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubscriptionAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformSettings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "advisorGovernanceDashboardEnabled" BOOLEAN NOT NULL DEFAULT true,
    "advisorRiskIntelligenceEnabled" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,
    "mfaVerified" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false
);

-- CreateTable
CREATE TABLE "Assessment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" "AssessmentStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "currentPillar" TEXT,
    "currentQuestionIndex" INTEGER DEFAULT 0,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "approvalId" TEXT,

    CONSTRAINT "Assessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssessmentResponse" (
    "id" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "pillar" TEXT NOT NULL,
    "subCategory" TEXT NOT NULL,
    "answer" JSONB NOT NULL,
    "skipped" BOOLEAN NOT NULL DEFAULT false,
    "answeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssessmentResponse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PillarScore" (
    "id" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "pillar" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "riskLevel" "RiskLevel" NOT NULL,
    "breakdown" JSONB NOT NULL,
    "missingControls" JSONB,
    "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PillarScore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HouseholdMember" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "age" INTEGER,
    "occupation" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "relationship" "FamilyRelationship" NOT NULL,
    "governanceRoles" "GovernanceRole"[],
    "isResident" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HouseholdMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntakeInterview" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "IntakeStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "currentQuestionIndex" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntakeInterview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntakeResponse" (
    "id" TEXT NOT NULL,
    "interviewId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "audioUrl" TEXT,
    "audioDuration" DOUBLE PRECISION,
    "transcription" TEXT,
    "transcriptionStatus" "TranscriptionStatus" NOT NULL DEFAULT 'PENDING',
    "answeredAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntakeResponse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GovernanceReviewLead" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "familyOfficeName" TEXT NOT NULL,
    "primaryAdvisor" TEXT,
    "familyComplexity" "FamilyComplexity" NOT NULL,
    "promptedInterest" TEXT,
    "assignedAdvisorId" TEXT,
    "assignedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GovernanceReviewLead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InviteCode" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "prefillEmail" TEXT,
    "expiresAt" TIMESTAMP(3),
    "maxUses" INTEGER,
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,
    "status" "InvitationStatus" NOT NULL DEFAULT 'SENT',
    "statusUpdatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "personalMessage" TEXT,
    "clientName" TEXT,
    "resendCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "InviteCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdvisorProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "specializations" TEXT[],
    "licenseNumber" TEXT,
    "firmName" TEXT,
    "bio" TEXT,
    "phone" TEXT,
    "jobTitle" TEXT,
    "logoUrl" TEXT,
    "brandName" TEXT,
    "tagline" TEXT,
    "primaryColor" TEXT,
    "secondaryColor" TEXT,
    "accentColor" TEXT,
    "websiteUrl" TEXT,
    "emailFooterText" TEXT,
    "supportEmail" TEXT,
    "supportPhone" TEXT,
    "logoS3Key" TEXT,
    "logoContentType" TEXT,
    "logoFileSize" INTEGER,
    "logoUploadedAt" TIMESTAMP(3),
    "brandingEnabled" BOOLEAN NOT NULL DEFAULT true,
    "customDomainEnabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdvisorProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "phone" TEXT,
    "addressLine1" TEXT,
    "addressLine2" TEXT,
    "city" TEXT,
    "state" TEXT,
    "postalCode" TEXT,
    "country" TEXT,
    "dateOfBirth" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientAdvisorAssignment" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "advisorId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "AssignmentStatus" NOT NULL DEFAULT 'ACTIVE',

    CONSTRAINT "ClientAdvisorAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntakeApproval" (
    "id" TEXT NOT NULL,
    "interviewId" TEXT NOT NULL,
    "advisorId" TEXT NOT NULL,
    "status" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "focusAreas" TEXT[],
    "notes" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntakeApproval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdvisorNotification" (
    "id" TEXT NOT NULL,
    "advisorId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "referenceId" TEXT,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdvisorNotification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentRequirement" (
    "id" TEXT NOT NULL,
    "advisorId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "fulfilled" BOOLEAN NOT NULL DEFAULT false,
    "fulfilledAt" TIMESTAMP(3),
    "fileKey" TEXT,
    "fileName" TEXT,
    "fileSize" INTEGER,
    "fileMimeType" TEXT,
    "lastReminderSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentRequirement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationPreference" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "emailEnabled" BOOLEAN NOT NULL DEFAULT true,
    "emailMilestones" BOOLEAN NOT NULL DEFAULT true,
    "emailReminders" BOOLEAN NOT NULL DEFAULT true,
    "emailStalled" BOOLEAN NOT NULL DEFAULT true,
    "emailRegistrations" BOOLEAN NOT NULL DEFAULT true,
    "reminderFrequencyDays" INTEGER NOT NULL DEFAULT 7,
    "quietStart" TEXT,
    "quietEnd" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationPreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdvisorSubdomain" (
    "id" TEXT NOT NULL,
    "advisorId" TEXT NOT NULL,
    "subdomain" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "dnsVerified" BOOLEAN NOT NULL DEFAULT false,
    "sslProvisioned" BOOLEAN NOT NULL DEFAULT false,
    "verifiedAt" TIMESTAMP(3),
    "lastCheckedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdvisorSubdomain_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReservedSubdomains" (
    "id" TEXT NOT NULL,
    "subdomain" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReservedSubdomains_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdvisorBrandingAuditLog" (
    "id" TEXT NOT NULL,
    "advisorId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "previousValues" JSONB,
    "newValues" JSONB,
    "metadata" JSONB,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,

    CONSTRAINT "AdvisorBrandingAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_userId_key" ON "Subscription"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_stripeCustomerId_key" ON "Subscription"("stripeCustomerId");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_stripeSubscriptionId_key" ON "Subscription"("stripeSubscriptionId");

-- CreateIndex
CREATE INDEX "Subscription_stripeCustomerId_idx" ON "Subscription"("stripeCustomerId");

-- CreateIndex
CREATE INDEX "Subscription_stripeSubscriptionId_idx" ON "Subscription"("stripeSubscriptionId");

-- CreateIndex
CREATE INDEX "SubscriptionAuditLog_subscriptionId_idx" ON "SubscriptionAuditLog"("subscriptionId");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE INDEX "Session_sessionToken_idx" ON "Session"("sessionToken");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE INDEX "Assessment_userId_idx" ON "Assessment"("userId");

-- CreateIndex
CREATE INDEX "Assessment_status_idx" ON "Assessment"("status");

-- CreateIndex
CREATE INDEX "AssessmentResponse_assessmentId_idx" ON "AssessmentResponse"("assessmentId");

-- CreateIndex
CREATE UNIQUE INDEX "AssessmentResponse_assessmentId_questionId_key" ON "AssessmentResponse"("assessmentId", "questionId");

-- CreateIndex
CREATE INDEX "PillarScore_assessmentId_idx" ON "PillarScore"("assessmentId");

-- CreateIndex
CREATE UNIQUE INDEX "PillarScore_assessmentId_pillar_key" ON "PillarScore"("assessmentId", "pillar");

-- CreateIndex
CREATE INDEX "HouseholdMember_userId_idx" ON "HouseholdMember"("userId");

-- CreateIndex
CREATE INDEX "IntakeInterview_userId_idx" ON "IntakeInterview"("userId");

-- CreateIndex
CREATE INDEX "IntakeInterview_status_idx" ON "IntakeInterview"("status");

-- CreateIndex
CREATE INDEX "IntakeResponse_interviewId_idx" ON "IntakeResponse"("interviewId");

-- CreateIndex
CREATE UNIQUE INDEX "IntakeResponse_interviewId_questionId_key" ON "IntakeResponse"("interviewId", "questionId");

-- CreateIndex
CREATE INDEX "GovernanceReviewLead_email_idx" ON "GovernanceReviewLead"("email");

-- CreateIndex
CREATE INDEX "GovernanceReviewLead_createdAt_idx" ON "GovernanceReviewLead"("createdAt");

-- CreateIndex
CREATE INDEX "GovernanceReviewLead_assignedAdvisorId_idx" ON "GovernanceReviewLead"("assignedAdvisorId");

-- CreateIndex
CREATE UNIQUE INDEX "InviteCode_code_key" ON "InviteCode"("code");

-- CreateIndex
CREATE INDEX "InviteCode_code_idx" ON "InviteCode"("code");

-- CreateIndex
CREATE INDEX "InviteCode_createdBy_idx" ON "InviteCode"("createdBy");

-- CreateIndex
CREATE INDEX "InviteCode_status_idx" ON "InviteCode"("status");

-- CreateIndex
CREATE UNIQUE INDEX "AdvisorProfile_userId_key" ON "AdvisorProfile"("userId");

-- CreateIndex
CREATE INDEX "AdvisorProfile_userId_idx" ON "AdvisorProfile"("userId");

-- CreateIndex
CREATE INDEX "AdvisorProfile_brandingEnabled_idx" ON "AdvisorProfile"("brandingEnabled");

-- CreateIndex
CREATE UNIQUE INDEX "ClientProfile_userId_key" ON "ClientProfile"("userId");

-- CreateIndex
CREATE INDEX "ClientProfile_userId_idx" ON "ClientProfile"("userId");

-- CreateIndex
CREATE INDEX "ClientAdvisorAssignment_advisorId_idx" ON "ClientAdvisorAssignment"("advisorId");

-- CreateIndex
CREATE INDEX "ClientAdvisorAssignment_clientId_idx" ON "ClientAdvisorAssignment"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "ClientAdvisorAssignment_clientId_advisorId_key" ON "ClientAdvisorAssignment"("clientId", "advisorId");

-- CreateIndex
CREATE UNIQUE INDEX "IntakeApproval_interviewId_key" ON "IntakeApproval"("interviewId");

-- CreateIndex
CREATE INDEX "IntakeApproval_advisorId_idx" ON "IntakeApproval"("advisorId");

-- CreateIndex
CREATE INDEX "IntakeApproval_interviewId_idx" ON "IntakeApproval"("interviewId");

-- CreateIndex
CREATE INDEX "AdvisorNotification_advisorId_read_idx" ON "AdvisorNotification"("advisorId", "read");

-- CreateIndex
CREATE INDEX "DocumentRequirement_advisorId_idx" ON "DocumentRequirement"("advisorId");

-- CreateIndex
CREATE INDEX "DocumentRequirement_clientId_idx" ON "DocumentRequirement"("clientId");

-- CreateIndex
CREATE INDEX "DocumentRequirement_advisorId_clientId_idx" ON "DocumentRequirement"("advisorId", "clientId");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationPreference_userId_key" ON "NotificationPreference"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "AdvisorSubdomain_advisorId_key" ON "AdvisorSubdomain"("advisorId");

-- CreateIndex
CREATE UNIQUE INDEX "AdvisorSubdomain_subdomain_key" ON "AdvisorSubdomain"("subdomain");

-- CreateIndex
CREATE INDEX "AdvisorSubdomain_advisorId_idx" ON "AdvisorSubdomain"("advisorId");

-- CreateIndex
CREATE INDEX "AdvisorSubdomain_isActive_idx" ON "AdvisorSubdomain"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "ReservedSubdomains_subdomain_key" ON "ReservedSubdomains"("subdomain");

-- CreateIndex
CREATE INDEX "AdvisorBrandingAuditLog_advisorId_idx" ON "AdvisorBrandingAuditLog"("advisorId");

-- CreateIndex
CREATE INDEX "AdvisorBrandingAuditLog_timestamp_idx" ON "AdvisorBrandingAuditLog"("timestamp");

-- CreateIndex
CREATE INDEX "AdvisorBrandingAuditLog_action_idx" ON "AdvisorBrandingAuditLog"("action");

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubscriptionAuditLog" ADD CONSTRAINT "SubscriptionAuditLog_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assessment" ADD CONSTRAINT "Assessment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentResponse" ADD CONSTRAINT "AssessmentResponse_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PillarScore" ADD CONSTRAINT "PillarScore_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HouseholdMember" ADD CONSTRAINT "HouseholdMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntakeInterview" ADD CONSTRAINT "IntakeInterview_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntakeResponse" ADD CONSTRAINT "IntakeResponse_interviewId_fkey" FOREIGN KEY ("interviewId") REFERENCES "IntakeInterview"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GovernanceReviewLead" ADD CONSTRAINT "GovernanceReviewLead_assignedAdvisorId_fkey" FOREIGN KEY ("assignedAdvisorId") REFERENCES "AdvisorProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InviteCode" ADD CONSTRAINT "InviteCode_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "AdvisorProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvisorProfile" ADD CONSTRAINT "AdvisorProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientProfile" ADD CONSTRAINT "ClientProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientAdvisorAssignment" ADD CONSTRAINT "ClientAdvisorAssignment_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientAdvisorAssignment" ADD CONSTRAINT "ClientAdvisorAssignment_advisorId_fkey" FOREIGN KEY ("advisorId") REFERENCES "AdvisorProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntakeApproval" ADD CONSTRAINT "IntakeApproval_interviewId_fkey" FOREIGN KEY ("interviewId") REFERENCES "IntakeInterview"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntakeApproval" ADD CONSTRAINT "IntakeApproval_advisorId_fkey" FOREIGN KEY ("advisorId") REFERENCES "AdvisorProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvisorNotification" ADD CONSTRAINT "AdvisorNotification_advisorId_fkey" FOREIGN KEY ("advisorId") REFERENCES "AdvisorProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentRequirement" ADD CONSTRAINT "DocumentRequirement_advisorId_fkey" FOREIGN KEY ("advisorId") REFERENCES "AdvisorProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentRequirement" ADD CONSTRAINT "DocumentRequirement_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationPreference" ADD CONSTRAINT "NotificationPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvisorSubdomain" ADD CONSTRAINT "AdvisorSubdomain_advisorId_fkey" FOREIGN KEY ("advisorId") REFERENCES "AdvisorProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvisorBrandingAuditLog" ADD CONSTRAINT "AdvisorBrandingAuditLog_advisorId_fkey" FOREIGN KEY ("advisorId") REFERENCES "AdvisorProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed singleton row for admin feature toggles (matches prior platform_settings migration).
INSERT INTO "PlatformSettings" ("id", "advisorGovernanceDashboardEnabled", "advisorRiskIntelligenceEnabled", "updatedAt")
VALUES ('default', true, true, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;
